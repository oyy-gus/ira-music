const { EmbedBuilder } = require('discord.js');
const { PlayerMigrationManager } = require('./PlayerMigrationManager');
const { NodeHealthMonitor } = require('./NodeHealthMonitor');
const RecoveryLock = require('./RecoveryLock');
const RecoveryMetrics = require('./RecoveryMetrics');
const SessionPersistence = require('./SessionPersistence');
const TwentyFourSevenGuard = require('./TwentyFourSevenGuard');
const playerSessionRepo = require('../../database/repositories/playerSessionRepository');
const logger = require('../../logger/logger');
const { cleanupPreviousBotMessages } = require('../../utils/channelUtils');
const { getEmoji } = require('../../config/emojis');
const { ensureStageSpeaker } = require('../../utils/stageUtils');

class RecoveryManager {
  constructor() {
    this.isRecovering = false;
    this.lastRecovered = new Map(); // guildId -> timestamp
  }

  /**
   * Main recovery routine called when bot starts up or a healthy Lavalink node connects
   * @param {Object} client - Discord Client
   * @param {string} triggerSource - 'STARTUP' | 'NODE_RECONNECTED' | 'MANUAL'
   */
  async recoverAllSessions(client, triggerSource = 'STARTUP') {
    if (!client?.lavalink) return;
    if (this.isRecovering) {
      return;
    }

    // Check if at least one Lavalink node is healthy and connected
    const healthyNode = PlayerMigrationManager.selectBestNode(client.lavalink);
    if (!healthyNode) {
      return;
    }

    // On startup, wait a moment for the Discord gateway to fully populate channel cache
    // so that we can successfully fetch and delete stale now-playing messages
    if (triggerSource === 'STARTUP') {
      await new Promise((resolve) => setTimeout(resolve, 3000));
    }

    this.isRecovering = true;

    try {
      const activeSessions = await playerSessionRepo.getAllActiveSessions();
      if (!activeSessions || activeSessions.length === 0) {
        return;
      }

      for (const session of activeSessions) {
        try {
          await this.recoverSingleSession(client, session, healthyNode, triggerSource);
        } catch (err) {
          logger.error(`[RecoveryManager] Failed recovering session for guild ${session.guildId}:`, {
            error: err.message,
          });
        }
      }
    } finally {
      this.isRecovering = false;
    }
  }

  /**
   * Recover a single guild session
   * @param {Object} client
   * @param {Object} session
   * @param {Object} targetNode
   * @param {string} triggerSource
   */
  async recoverSingleSession(client, session, targetNode, triggerSource = 'STARTUP') {
    const guildId = session.guildId;
    const now = Date.now();

    // Check recovery cooldown (prevent duplicate spam within 45s)
    const lastTime = this.lastRecovered.get(guildId) || 0;
    if (now - lastTime < 45000) {
      return;
    }

    // Check if player is already active in memory
    const existingPlayer = client.lavalink.players.get(guildId);
    if (existingPlayer && existingPlayer.connected) {
      return;
    }

    const recoveryId = `rec-${guildId}-${now}`;
    const startTime = Date.now();

    // Acquire lock to avoid duplicate players
    if (!RecoveryLock.acquire(guildId, recoveryId, 45000)) {
      return;
    }

    this.lastRecovered.set(guildId, now);

    RecoveryMetrics.increment('player_recovery_total');
    RecoveryMetrics.logEvent('PLAYER_RECOVERY_STARTED', {
      guildId,
      newNodeId: targetNode?.id || 'auto',
      migrationId: recoveryId,
      reason: triggerSource,
    });

    try {
      // 1. Verify guild and voice channel still exist (with fetch fallbacks)
      let guild = client.guilds.cache.get(guildId);
      if (!guild && typeof client.guilds.fetch === 'function') {
        guild = await client.guilds.fetch(guildId).catch(() => null);
      }
      if (!guild) {
        logger.warn(`[RecoveryManager] Guild ${guildId} not found in client cache or API. Cleaning up session.`);
        await SessionPersistence.deleteSession(guildId);
        RecoveryLock.release(guildId, recoveryId);
        return;
      }

      // Determine target voice channel ID (session ID or current bot voice channel ID fallback)
      const targetVcId = session.voiceChannelId || guild.members.me?.voice?.channelId;
      if (!targetVcId) {
        logger.warn(`[RecoveryManager] Voice channel ID is null/missing for guild ${guildId}. Cleaning up session.`);
        await SessionPersistence.deleteSession(guildId);
        RecoveryLock.release(guildId, recoveryId);
        return;
      }

      let voiceChannel = guild.channels.cache.get(targetVcId);
      if (!voiceChannel && typeof guild.channels.fetch === 'function') {
        voiceChannel = await guild.channels.fetch(targetVcId).catch(() => null);
      }
      if (!voiceChannel) {
        logger.warn(`[RecoveryManager] Voice channel ${targetVcId} not found in guild ${guildId}. Cleaning up session.`);
        await SessionPersistence.deleteSession(guildId);
        RecoveryLock.release(guildId, recoveryId);
        return;
      }

      // Ensure session voiceChannelId is updated to the valid channel
      session.voiceChannelId = targetVcId;

      // 2. Create player
      let player = existingPlayer;
      if (!player) {
        player = client.lavalink.createPlayer({
          guildId: session.guildId,
          voiceChannelId: session.voiceChannelId,
          textChannelId: session.textChannelId,
          selfDeaf: true,
          selfMute: false,
          volume: session.volume || 100,
          node: targetNode ? targetNode.id : undefined,
        });
      }

      if (typeof player.set === 'function') {
        player.set('voiceChannelId', session.voiceChannelId);
        if (session.textChannelId) player.set('textChannelId', session.textChannelId);
      }

      // 3. Connect voice
      if (!player.connected) {
        await player.connect();
      }

      // Ensure bot is unsuppressed if joining a Stage Channel
      await ensureStageSpeaker(guild, session.voiceChannelId);

      // 4. Restore settings: volume, filters, repeat, autoplay
      if (session.volume) player.setVolume(session.volume);
      if (session.repeatMode) player.setRepeatMode(session.repeatMode);
      if (session.autoplay) player.set('autoplay', true);

      // Re-hydrate 24/7 flag if this guild has 247 enabled in the database
      // This is critical after bot restarts so queueEnd/nodeManager logic keeps 247 alive
      const guildRepo = require('../../database/repositories/guildRepository');
      const freshSettings = await guildRepo.getGuildSettings(guildId).catch(() => null);
      if (freshSettings?.musicSettings?.twentyFourSeven) {
        TwentyFourSevenGuard.rehydrate247Flag(player);
      }

      // Helper to reconstruct track object structure with `info` sub-object for lavalink-client compatibility
      const reconstructTrack = (t) => {
        if (!t) return null;
        return {
          encoded: t.encoded || null,
          info: {
            identifier: t.identifier || null,
            title: t.title || 'Unknown Title',
            author: t.author || 'Unknown Artist',
            sourceName: t.source || 'youtube',
            uri: t.uri || null,
            duration: t.duration || 0,
            artworkUrl: t.artworkUrl || null,
            isStream: Boolean(t.isStream),
            isSeekable: t.isSeekable !== false,
          },
          userData: {
            requesterId: t.userData?.requesterId || null,
            requesterTag: t.userData?.requesterTag || null,
          },
        };
      };

      // 5. Restore previous tracks history
      if (Array.isArray(session.previousTracks) && session.previousTracks.length > 0) {
        player.queue.previous = session.previousTracks.map(reconstructTrack).filter(Boolean);
      }

      // 6. Restore upcoming queue tracks
      if (Array.isArray(session.queue) && session.queue.length > 0) {
        const restoredQueue = session.queue.map(reconstructTrack).filter(Boolean);
        player.queue.add(restoredQueue);
      }

      // 7. Calculate elapsed time if bot restarted recently
      let resumePosition = session.position || 0;
      if (session.positionUpdatedAt && session.currentTrack?.duration) {
        const elapsedSinceSave = Date.now() - new Date(session.positionUpdatedAt).getTime();
        // If save happened within last 2 minutes, advance position
        if (elapsedSinceSave > 0 && elapsedSinceSave < 120000) {
          resumePosition = Math.min(session.currentTrack.duration - 1000, resumePosition + elapsedSinceSave);
        }
      }

      // 7.5 Delete old now-playing message from the persisted session
      // NOTE: after a restart client.channels.cache may be empty, so we fallback to channel.fetch()
      if (session.nowPlayingMessageId && session.textChannelId) {
        try {
          let textCh = client.channels.cache.get(session.textChannelId);
          if (!textCh) {
            textCh = await client.channels.fetch(session.textChannelId).catch(() => null);
          }
          if (textCh && textCh.messages) {
            const oldMsg = await textCh.messages.fetch(session.nowPlayingMessageId).catch(() => null);
            if (oldMsg) await oldMsg.delete().catch(() => {});
          }
        } catch (_) {}
        // Clear the saved ID so it is not attempted again on next recovery cycle
        session.nowPlayingMessageId = null;
        playerSessionRepo.saveSession({ ...session, nowPlayingMessageId: null }).catch(() => {});
      }

      // 8. Restore current track & resume playback with preserved requester userData
      if (session.currentTrack) {
        const reconstructedCurrent = reconstructTrack(session.currentTrack);
        const trackUserData = {
          requesterId: session.currentTrack.userData?.requesterId || null,
          requesterTag: session.currentTrack.userData?.requesterTag || null,
        };
        if (trackUserData.requesterId || trackUserData.requesterTag) {
          player.set('recoveredUserData', trackUserData);
        }

        if (!player.playing) {
          // Try playing directly using encoded string first
          let playedDirectly = false;
          if (reconstructedCurrent.encoded) {
            try {
              await player.play({
                track: { encoded: reconstructedCurrent.encoded },
                position: resumePosition,
              });
              player.queue.current = reconstructedCurrent;
              playedDirectly = true;
            } catch (encodedErr) {
              logger.warn(`[RecoveryManager] Direct encoded track play failed for guild ${guildId}: ${encodedErr.message}`);
            }
          }

          if (!playedDirectly) {
            await PlayerMigrationManager.resolveAndResumeTrack(client, player, reconstructedCurrent, resumePosition);
          }
        }
      } else if (player.queue.tracks.length > 0) {
        await player.play();
      }

      const duration = Date.now() - startTime;
      RecoveryMetrics.recordRecoveryDuration(duration);
      RecoveryMetrics.increment('playback_resume_total');
      RecoveryMetrics.logEvent('PLAYER_RECOVERY_SUCCESS', {
        guildId,
        newNodeId: player.node?.id || 'unknown',
        migrationId: recoveryId,
        durationMs: duration,
      });

      // 9. Persist restored state
      SessionPersistence.saveSnapshot(player, true, 'NORMAL');

      // 10. Notify text channel
      if (session.textChannelId) {
        const activeTrack = player.queue.current || session.currentTrack || (player.queue.tracks && player.queue.tracks[0]);
        const currentTitle = activeTrack?.info?.title || activeTrack?.title || session.currentTrack?.title;
        const currentUri = activeTrack?.info?.uri || activeTrack?.uri || session.currentTrack?.uri;

        const recEmoji = getEmoji('recovery', client);
        let description = 'Bot connection restored and ready for music commands!';

        if (currentTitle) {
          const trackLink = currentUri ? `[**${currentTitle}**](${currentUri})` : `**${currentTitle}**`;
          const posSec = Math.floor(resumePosition / 1000);
          const mins = Math.floor(posSec / 60);
          const secs = (posSec % 60).toString().padStart(2, '0');
          description = `Bot connection restored! Resumed playback of ${trackLink} from \`${mins}:${secs}\`.`;
        }

        const embed = new EmbedBuilder()
          .setTitle(`${recEmoji ? `${recEmoji} ` : ''}Audio Session Recovered`)
          .setDescription(description)
          .setColor(0x57F287);

        const channel = client.channels.cache.get(session.textChannelId);
        if (channel) {
          channel.send({ embeds: [embed] }).then((msg) => {
            // Auto-delete recovery message after 6 seconds
            setTimeout(() => {
              msg.delete().catch(() => {});
            }, 6000);
          }).catch(() => {});
        }
      }

      RecoveryLock.release(guildId, recoveryId);
      logger.info(`[RecoveryManager] Guild ${guildId} playback session recovered successfully in ${duration}ms.`);
    } catch (error) {
      const duration = Date.now() - startTime;
      RecoveryMetrics.increment('player_recovery_failures_total');
      RecoveryMetrics.logEvent('PLAYER_RECOVERY_FAILED', {
        guildId,
        migrationId: recoveryId,
        reason: error.message,
        durationMs: duration,
      });

      logger.error(`[RecoveryManager] Recovery failed for guild ${guildId}:`, { error: error.message });
      RecoveryLock.release(guildId, recoveryId);
    }
  }
}

module.exports = new RecoveryManager();
