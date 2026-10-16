const { EmbedBuilder } = require('discord.js');
const { NodeHealthMonitor, NodeStatus } = require('./NodeHealthMonitor');
const RecoveryLock = require('./RecoveryLock');
const RecoveryMetrics = require('./RecoveryMetrics');
const SessionPersistence = require('./SessionPersistence');
const playerSessionRepo = require('../../database/repositories/playerSessionRepository');
const logger = require('../../logger/logger');
const { getEmoji } = require('../../config/emojis');

const MigrationState = {
  NORMAL: 'NORMAL',
  MIGRATING: 'MIGRATING',
  RECOVERING: 'RECOVERING',
  RECOVERED: 'RECOVERED',
  FAILED: 'FAILED',
};

class PlayerMigrationManager {
  constructor() {
    this.migrationHistory = new Map(); // guildId -> { lastMigratedAt, count, recentNodes }
    this.maxRetries = 3;
    this.loopCooldownMs = 30000; // 30s cooldown for loop prevention
    this.maxMigrationsInWindow = 3;
  }

  /**
   * Find the best healthy Lavalink node for a given player/guild
   * @param {Object} lavalinkManager
   * @param {string} excludeNodeId
   * @param {string} preferredRegion
   * @returns {Object|null} Selected Lavalink node
   */
  selectBestNode(lavalinkManager, excludeNodeId = null, preferredRegion = null) {
    if (!lavalinkManager?.nodeManager?.nodes) return null;

    const candidateNodes = Array.from(lavalinkManager.nodeManager.nodes.values()).filter((node) => {
      if (!node.connected) return false;
      if (excludeNodeId && node.id === excludeNodeId) return false;
      return NodeHealthMonitor.isNodeUsable(node.id);
    });

    if (candidateNodes.length === 0) {
      // Fallback: any connected node that is not excluded
      const fallbackNodes = Array.from(lavalinkManager.nodeManager.nodes.values()).filter((node) => {
        if (!node.connected) return false;
        if (excludeNodeId && node.id === excludeNodeId) return false;
        return true;
      });
      if (fallbackNodes.length > 0) return fallbackNodes[0];
      return null;
    }

    // Score candidates (lower score is better)
    candidateNodes.sort((a, b) => {
      const statsA = NodeHealthMonitor.getNodeStats(a.id) || {
        latency: 100,
        players: 0,
        cpu: { system: 0 },
        errorRate: 0,
        connectionStability: 100,
      };
      const statsB = NodeHealthMonitor.getNodeStats(b.id) || {
        latency: 100,
        players: 0,
        cpu: { system: 0 },
        errorRate: 0,
        connectionStability: 100,
      };

      let scoreA = statsA.latency * 0.4 + statsA.players * 15 + statsA.cpu.system * 2 + statsA.errorRate * 50 - statsA.connectionStability * 0.5;
      let scoreB = statsB.latency * 0.4 + statsB.players * 15 + statsB.cpu.system * 2 + statsB.errorRate * 50 - statsB.connectionStability * 0.5;

      if (preferredRegion) {
        if (statsA.region === preferredRegion) scoreA -= 100;
        if (statsB.region === preferredRegion) scoreB -= 100;
      }

      return scoreA - scoreB;
    });

    return candidateNodes[0] || null;
  }

  /**
   * Loop protection check: detect rapid bouncing between nodes
   */
  checkLoopProtection(guildId, targetNodeId) {
    const now = Date.now();
    let history = this.migrationHistory.get(guildId);

    if (!history) {
      history = { lastMigratedAt: now, count: 0, windowStart: now, recentNodes: [] };
      this.migrationHistory.set(guildId, history);
    }

    // Reset window after 2 minutes
    if (now - history.windowStart > 120000) {
      history.count = 0;
      history.windowStart = now;
      history.recentNodes = [];
    }

    history.count += 1;
    history.lastMigratedAt = now;
    history.recentNodes.push({ nodeId: targetNodeId, time: now });

    if (history.count > this.maxMigrationsInWindow) {
      logger.warn(`[LoopProtection] Guild ${guildId} triggered migration loop protection (${history.count} migrations in window).`);
      return false; // Loop detected
    }

    return true;
  }

  /**
   * Migrate a single active player from an old/failing node to a healthy node
   * @param {Object} client
   * @param {Object} player
   * @param {string} reason
   * @returns {Promise<boolean>}
   */
  async migratePlayer(client, player, reason = 'Node Disconnected') {
    if (!player || !player.guildId) return false;
    const guildId = player.guildId;
    const migrationId = `mig-${guildId}-${Date.now()}`;
    const startTime = Date.now();
    const oldNodeId = player.node?.id || 'unknown';

    // Acquire recovery lock to prevent duplicate migration / player creation
    if (!RecoveryLock.acquire(guildId, migrationId, 45000)) {
      logger.warn(`[PlayerMigration] Guild ${guildId} migration skipped: lock already acquired.`);
      return false;
    }

    RecoveryMetrics.increment('player_migrations_total');
    RecoveryMetrics.logEvent('PLAYER_MIGRATION_STARTED', {
      guildId,
      oldNodeId,
      migrationId,
      reason,
      trackTitle: player.queue.current?.info?.title || 'None',
    });

    try {
      // 1. Snapshot current state before anything changes
      const snapshot = SessionPersistence.extractSnapshot(player, MigrationState.MIGRATING);
      SessionPersistence.saveSnapshot(player, true, MigrationState.MIGRATING);

      // 2. Select target healthy node
      const targetNode = this.selectBestNode(client.lavalink, oldNodeId);
      if (!targetNode) {
        logger.error(`[PlayerMigration] No healthy alternative Lavalink node available for guild ${guildId}!`);
        RecoveryMetrics.increment('player_migration_failures_total');
        RecoveryMetrics.logEvent('PLAYER_MIGRATION_FAILED', {
          guildId,
          oldNodeId,
          migrationId,
          reason: 'NO_HEALTHY_NODES_AVAILABLE',
        });
        await playerSessionRepo.updateSessionStatus(guildId, MigrationState.RECOVERING, 'NO_HEALTHY_NODES');
        const warnEmoji = getEmoji('warning', client) || getEmoji('error', client);
        this.notifyChannel(client, player.textChannelId, {
          title: `${warnEmoji ? `${warnEmoji} ` : ''}All Music Nodes Unavailable`,
          description: 'All audio nodes are currently offline. Your queue is saved and playback will **automatically resume** once a node comes back online.',
          color: 0xED4245,
        });
        RecoveryLock.release(guildId, migrationId);
        return false;
      }

      // Check loop protection
      if (!this.checkLoopProtection(guildId, targetNode.id)) {
        logger.warn(`[PlayerMigration] Cooldown active for guild ${guildId}, delaying migration attempt.`);
        await new Promise((res) => setTimeout(res, 2000));
      }

      logger.info(`[PlayerMigration] Migrating player in guild ${guildId} from ${oldNodeId} -> ${targetNode.id}...`);

      // 3. Perform seamless node switch or recreation
      let migrationSuccess = false;
      let attempt = 0;

      while (attempt < this.maxRetries && !migrationSuccess) {
        attempt++;
        try {
          // Calculate resume position compensating for elapsed migration time
          const elapsed = Date.now() - startTime;
          const originalPosition = snapshot?.position || player.position || 0;
          const trackDuration = snapshot?.currentTrack?.duration || player.queue.current?.info?.duration || 0;
          let resumePosition = originalPosition + elapsed;
          if (trackDuration > 0 && resumePosition >= trackDuration) {
            resumePosition = Math.max(0, trackDuration - 2000);
          }

          // Try native player.changeNode if supported by lavalink-client
          let changedViaMethod = false;
          if (typeof player.changeNode === 'function') {
            try {
              await player.changeNode(targetNode.id, false);
              changedViaMethod = true;
            } catch (changeErr) {
              logger.warn(`[PlayerMigration] player.changeNode failed: ${changeErr.message}. Falling back to node reassignment.`);
            }
          }

          if (!changedViaMethod) {
            player.node = targetNode;
          }

          // Ensure voice channel is connected
          if (!player.connected && snapshot.voiceChannelId) {
            await player.connect();
          }

          // Restore volume and filters
          if (snapshot.volume && player.volume !== snapshot.volume) {
            await player.setVolume(snapshot.volume);
          }
          if (snapshot.repeatMode) {
            player.setRepeatMode(snapshot.repeatMode);
          }
          if (snapshot.autoplay) {
            player.set('autoplay', true);
          }

          // If playing a track, resume playback from compensated position
          if (snapshot.currentTrack) {
            const trackToPlay = player.queue.current || snapshot.currentTrack;
            if (!player.playing) {
              try {
                await player.play({
                  track: trackToPlay.encoded ? { encoded: trackToPlay.encoded } : undefined,
                  position: resumePosition,
                });
              } catch (playErr) {
                logger.warn(`[PlayerMigration] Direct resume failed (${playErr.message}), attempting track resolution...`);
                await this.resolveAndResumeTrack(client, player, snapshot.currentTrack, resumePosition);
              }
            }
          }

          migrationSuccess = true;
        } catch (attemptErr) {
          logger.warn(`[PlayerMigration] Attempt ${attempt} failed for guild ${guildId}: ${attemptErr.message}`);
          if (attempt < this.maxRetries) {
            const backoff = Math.pow(2, attempt) * 500;
            await new Promise((res) => setTimeout(res, backoff));
          }
        }
      }

      const duration = Date.now() - startTime;
      RecoveryMetrics.recordMigrationDuration(duration);

      if (migrationSuccess) {
        RecoveryMetrics.increment('playback_resume_total');
        RecoveryMetrics.logEvent('PLAYER_MIGRATION_SUCCESS', {
          guildId,
          oldNodeId,
          newNodeId: targetNode.id,
          migrationId,
          durationMs: duration,
        });

        SessionPersistence.saveSnapshot(player, true, MigrationState.NORMAL);

        const activeTrack = player.queue.current || snapshot.currentTrack || (player.queue.tracks && player.queue.tracks[0]);
        const currentTitle = activeTrack?.info?.title || activeTrack?.title || snapshot.currentTrack?.title;
        const currentUri = activeTrack?.info?.uri || activeTrack?.uri || snapshot.currentTrack?.uri;

        let description = `Switched seamlessly to node **${targetNode.id}**.`;
        if (currentTitle) {
          const trackLink = currentUri ? `[**${currentTitle}**](${currentUri})` : `**${currentTitle}**`;
          const resumePosSec = Math.floor((snapshot.position || 0) / 1000);
          const mins = Math.floor(resumePosSec / 60);
          const secs = (resumePosSec % 60).toString().padStart(2, '0');
          description += `\nResumed playback of ${trackLink} from \`${mins}:${secs}\`.`;
        }

        const reconnectEmoji = getEmoji('reconnect', client) || getEmoji('connected', client);
        this.notifyChannel(client, snapshot.textChannelId, {
          title: `${reconnectEmoji ? `${reconnectEmoji} ` : ''}Lavalink Failover Succeeded`,
          description,
          color: 0x57F287,
        });

        RecoveryLock.release(guildId, migrationId);
        return true;
      } else {
        throw new Error(`All ${this.maxRetries} migration attempts failed.`);
      }
    } catch (error) {
      const duration = Date.now() - startTime;
      RecoveryMetrics.increment('player_migration_failures_total');
      RecoveryMetrics.increment('playback_resume_failures_total');
      RecoveryMetrics.logEvent('PLAYER_MIGRATION_FAILED', {
        guildId,
        oldNodeId,
        migrationId,
        reason: error.message,
        durationMs: duration,
      });

      logger.error(`[PlayerMigration] Failed to migrate guild ${guildId}:`, { error: error.message });
      await playerSessionRepo.updateSessionStatus(guildId, MigrationState.FAILED, error.message);

      const errEmoji = getEmoji('warning', client) || getEmoji('error', client);
      this.notifyChannel(client, player.textChannelId, {
        title: `${errEmoji ? `${errEmoji} ` : ''}Playback Migration Failed`,
        description: 'Encountered an issue during node switch. Type `*play` or `*resume` to continue playing.',
        color: 0xED4245,
      });

      RecoveryLock.release(guildId, migrationId);
      return false;
    }
  }

  /**
   * Helper to re-resolve track if encoded track fails
   */
  async resolveAndResumeTrack(client, player, trackData, resumePosition) {
    if (!trackData) return;
    const query = trackData.uri || `${trackData.title} ${trackData.author}`;
    const requester = { id: trackData.userData?.requesterId || client.user.id, tag: trackData.userData?.requesterTag || 'Recovery' };

    try {
      const TrackResolver = require('../resolver/TrackResolver');
      const res = await TrackResolver.resolve(player, query, requester);
      if (res && res.tracks && res.tracks.length > 0) {
        const resolved = res.tracks[0];
        player.queue.current = resolved;
        await player.play({ position: resumePosition });
      }
    } catch (resErr) {
      logger.error(`[PlayerMigration] Track re-resolution failed for "${trackData.title}": ${resErr.message}. Skipping to next in queue.`);
      if (player.queue.tracks.length > 0) {
        await player.skip();
      }
    }
  }

  async notifyChannel(client, textChannelId, { title, description, color }, autoDeleteMs = 6000) {
    if (!textChannelId) return;
    const channel = client.channels.cache.get(textChannelId);
    if (!channel) return;

    const embed = new EmbedBuilder().setTitle(title).setDescription(description).setColor(color);
    channel.send({ embeds: [embed] }).then((msg) => {
      if (autoDeleteMs > 0) {
        setTimeout(() => msg.delete().catch(() => {}), autoDeleteMs);
      }
    }).catch(() => {});
  }
}


module.exports = {
  PlayerMigrationManager: new PlayerMigrationManager(),
  MigrationState,
};
