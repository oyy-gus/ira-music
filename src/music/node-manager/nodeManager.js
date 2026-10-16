const { LavalinkManager } = require('lavalink-client');
const { EmbedBuilder, Routes } = require('discord.js');
const config = require('../../config');
const logger = require('../../logger/logger');
const RecommendationEngine = require('../autoplay/recommendationEngine');
const { getEmoji } = require('../../config/emojis');
const { formatDuration } = require('../../utils/timeUtils');

// Unified helper to read autoplay state from player (handles both Map and plain Object data)
const getAutoplayState = (player) => {
  if (!player) return false;
  RecommendationEngine.ensurePlayerData(player);
  return !!(player.data.get('autoplay') || (typeof player.get === 'function' && player.get('autoplay')));
};
const { recordTrackPlay } = require('../../database/repositories/userRepository');
const WebhookLogger = require('../../services/webhookLogger');

// Failover & High Availability Subsystems
const { NodeHealthMonitor } = require('../failover/NodeHealthMonitor');
const FailureDetector = require('../failover/FailureDetector');
const { PlayerMigrationManager } = require('../failover/PlayerMigrationManager');
const SessionPersistence = require('../failover/SessionPersistence');
const RecoveryManager = require('../failover/RecoveryManager');

// Analytics & Cloud Extensions
const playbackEventEmitter = require('../../analytics/playbackEventEmitter');
const ListeningStreak = require('../../cloud/listeningStreak');
const { AchievementEngine } = require('../../cloud/achievementEngine');
const ProfileManager = require('../../cloud/profileManager');

const _performDeleteNowPlaying = async (player, clientOverride = null) => {
  if (!player) return;

  // 1. Immediately extract and null out references to prevent race conditions
  const msgObj = player.nowPlayingMessage;
  const msgId = player.nowPlayingMessageId || (typeof player.get === 'function' ? player.get('nowPlayingMessageId') : null);

  player.nowPlayingMessage = null;
  player.nowPlayingMessageId = null;
  if (typeof player.set === 'function') {
    try { player.set('nowPlayingMessageId', null); } catch {}
  }

  // 2. Delete using direct message object reference if available
  if (msgObj) {
    try {
      await msgObj.delete().catch(() => {});
    } catch (_) {}
  }

  // 3. Delete using message ID fallback (useful across restarts/session recoveries)
  const targetClient = clientOverride || player.client;
  if (msgId && targetClient && (!msgObj || msgObj.id !== msgId)) {
    if (player.textChannelId) {
      try {
        let channel = targetClient.channels.cache.get(player.textChannelId);
        if (!channel && typeof targetClient.channels.fetch === 'function') {
          channel = await targetClient.channels.fetch(player.textChannelId).catch(() => null);
        }
        if (channel && channel.messages) {
          const msg = await channel.messages.fetch(msgId).catch(() => null);
          if (msg) {
            await msg.delete().catch(() => {});
          }
        }
      } catch (_) {}
    }
  }
};

const deleteNowPlayingMessage = async (player, clientOverride = null) => {
  if (!player) return;
  player._npQueue = (player._npQueue || Promise.resolve())
    .then(() => _performDeleteNowPlaying(player, clientOverride))
    .catch(() => {});
  await player._npQueue;
};

const updateVoiceChannelStatus = async (client, voiceChannelId, statusText = '') => {
  if (!voiceChannelId) return;
  try {
    const channel = client.channels.cache.get(voiceChannelId);
    const sanitizedStatus = statusText ? statusText.slice(0, 100) : '';
    if (channel && typeof channel.setStatus === 'function') {
      await channel.setStatus(sanitizedStatus);
    } else if (Routes && typeof Routes.channelVoiceStatus === 'function') {
      await client.rest.put(Routes.channelVoiceStatus(voiceChannelId), {
        body: { status: sanitizedStatus },
      });
    }
  } catch (err) {
    logger.debug(`[VoiceStatus] Failed to update voice channel status (${voiceChannelId}): ${err.message}`);
  }
};

const initLavalink = (client) => {
  const lavalink = new LavalinkManager({
    nodes: config.lavalink.nodes,
    sendToShard: (guildId, payload) => {
      const guild = client.guilds.cache.get(guildId);
      if (guild) guild.shard.send(payload);
    },
    client: {
      id: config.discord.clientId || client.user?.id,
      username: client.user?.username || 'BotIraMusic',
    },
    autoSkip: true,
    playerOptions: {
      defaultSearchPlatform: 'ytsearch',
      volumeDecrementer: 0.75,
      clientBasedPositionUpdateInterval: 50,
    },
    queueOptions: {
      maxPreviousTracks: 25,
    },
  });

  // Start periodic health monitor and session persistence background routines
  NodeHealthMonitor.start(lavalink);
  SessionPersistence.start(client, 5000);

  // Attach event handlers for node cluster management
  lavalink.nodeManager.on('connect', async (node) => {
    logger.info(`[LavalinkCluster] Node connected: ${node.id}`);
    FailureDetector.handleNodeConnect(node);

    WebhookLogger.sendSystemLog({
      title: '🌐 Lavalink Node Connected',
      description: `Lavalink Node \`${node.id}\` connected successfully!`,
      level: 'info',
      fields: [
        { name: 'Node ID', value: `\`${node.id}\``, inline: true },
        { name: 'Host', value: `\`${node.options.host}:${node.options.port}\``, inline: true },
      ],
    });

    // Auto-resume pending sessions only if there are disconnected players
    const hasDisconnectedPlayers = Array.from(client.lavalink.players.values()).some((p) => !p.connected || !p.node?.connected);
    if (hasDisconnectedPlayers) {
      RecoveryManager.recoverAllSessions(client, 'NODE_RECONNECTED').catch((err) => {
        logger.error(`[LavalinkCluster] Error during auto-recovery on node ${node.id} connect:`, {
          error: err.message,
        });
      });
    }
  });

  lavalink.nodeManager.on('disconnect', async (node, reason) => {
    logger.warn(`[LavalinkCluster] Node disconnected: ${node.id}. Reason: ${reason?.reason || 'Unknown'}`);
    FailureDetector.handleNodeDisconnect(client, node, reason).catch((err) => {
      logger.error(`[LavalinkCluster] Error handling node disconnect for ${node.id}:`, {
        error: err.message,
      });
    });

    WebhookLogger.sendSystemLog({
      title: '⚠️ Lavalink Node Disconnected',
      description: `Lavalink Node \`${node.id}\` disconnected.`,
      level: 'warn',
      fields: [
        { name: 'Node ID', value: `\`${node.id}\``, inline: true },
        { name: 'Reason', value: `\`${reason?.reason || 'Unknown'}\``, inline: true },
      ],
    });
  });

  lavalink.nodeManager.on('error', (node, error) => {
    FailureDetector.handleNodeError(client, node, error);
  });

  lavalink.nodeManager.on('reconnecting', (node) => {
    FailureDetector.handleNodeReconnecting(node);
  });

  // Track playback lifecycle events
  lavalink.on('trackStart', async (player, track) => {
    player._trackErrorCount = 0;
    if (!player.data) player.data = {};
    const setPlayerData = (key, val) => {
      if (typeof player.data.set === 'function') player.data.set(key, val);
      else player.data[key] = val;
      if (typeof player.set === 'function') { try { player.set(key, val); } catch {} }
    };

    if (track.info?.identifier) {
      setPlayerData('identifier', track.info.identifier);
    }
    if (track.userData) {
      setPlayerData('requester', track.userData);
    }

    // Record into autoplay history to prevent repeats
    if (track.info?.identifier) {
      RecommendationEngine.recordPlayed(player, track.info.identifier);
    }

    if (!player.playedHistory) player.playedHistory = new Set();
    if (track.info?.identifier) player.playedHistory.add(track.info.identifier);
    if (track.info?.uri) player.playedHistory.add(track.info.uri);

    // Immediate state persistence
    SessionPersistence.saveSnapshot(player, true, 'PLAYING');

    // Update Voice Channel Status
    if (player.voiceChannelId) {
      const statusTitle = track.info?.title ? `🎶 ${track.info.title.slice(0, 80)}` : '🎶 Playing Music';
      updateVoiceChannelStatus(client, player.voiceChannelId, statusTitle);
    }

    // Dispatch Analytics Event
    playbackEventEmitter.emitEvent('TRACK_START', {
      guildId: player.guildId,
      userId: track.userData?.requesterId || null,
      playerId: player.guildId,
      trackId: track.info?.identifier || track.info?.uri || 'unknown',
      metadata: {
        title: track.info?.title,
        author: track.info?.author,
        duration: track.info?.duration,
        source: track.info?.sourceName,
        nodeId: player.node?.id,
      },
    });

    // Send Music Webhook Log
    const guildObj = client.guilds.cache.get(player.guildId);
    const requesterUser = track.userData?.requesterId ? client.users.cache.get(track.userData.requesterId) : null;
    const requesterMember = (guildObj && track.userData?.requesterId) ? guildObj.members.cache.get(track.userData.requesterId) : null;

    WebhookLogger.sendMusicLog({
      event: 'TRACK_START',
      player: {
        ...player,
        guildName: guildObj?.name || `Guild ${player.guildId}`,
      },
      track,
      requester: requesterMember || requesterUser,
    });

    const botId = client.user?.id;
    if (track.userData?.requesterId && track.userData.requesterId !== botId) {
      // Skip stat recording if the requester is the bot itself (autoplay, recovery, etc.)
      // Record Streak & evaluate achievements
      ListeningStreak.recordActivity(track.userData.requesterId).catch(() => {});
      ProfileManager.getOrCreateProfile(track.userData.requesterId).then((prof) => {
        if (prof) {
          prof.statistics.totalTracksPlayed = (prof.statistics.totalTracksPlayed || 0) + 1;
          prof.statistics.totalListeningTimeMs = (prof.statistics.totalListeningTimeMs || 0) + (track.info?.duration || 0);
          prof.save().then(() => {
            AchievementEngine.evaluateAchievements(track.userData.requesterId, prof.statistics, prof.streak).catch(() => {});
          });
        }
      }).catch(() => {});

      const guild = client.guilds.cache.get(player.guildId);
      let companions = [];
      if (guild && player.voiceChannelId) {
        const vc = guild.channels.cache.get(player.voiceChannelId);
        if (vc && vc.members) {
          companions = Array.from(vc.members.values()).filter((m) => !m.user.bot);
        }
      }

      recordTrackPlay(track.userData.requesterId, track, guild, companions);
    }

    // Queue delete & send atomically on per-player promise queue to prevent race conditions & duplicate embeds
    player._npQueue = (player._npQueue || Promise.resolve()).then(async () => {
      // 1. Delete previous now-playing message if present
      await _performDeleteNowPlaying(player, client);

      if (!player.textChannelId) return;
      let channel = client.channels.cache.get(player.textChannelId);
      if (!channel && typeof client.channels.fetch === 'function') {
        channel = await client.channels.fetch(player.textChannelId).catch(() => null);
      }
      if (!channel) return;

      const durationStr = formatDuration(track.info.duration, { isStream: track.info.isStream });

      // Resolve requester string robustly across session recoveries
      let requester = 'Unknown';
      const recData = player.get('recoveredUserData');
      if (track.userData?.requesterTag) {
        const tag = track.userData.requesterTag;
        // If this is an autoplay marker, render with app emoji instead of stored unicode
        if (tag.startsWith('Autoplay')) {
          requester = `${getEmoji('autoplay', client) || '📻'} Autoplay`;
        } else {
          requester = tag;
        }
      } else if (track.userData?.requesterId) {
        const user = client.users.cache.get(track.userData.requesterId);
        requester = user ? user.tag : `<@${track.userData.requesterId}>`;
      } else if (recData?.requesterTag) {
        const tag = recData.requesterTag;
        if (tag.startsWith('Autoplay')) {
          requester = `${getEmoji('autoplay', client) || '📻'} Autoplay`;
        } else {
          requester = tag;
        }
      } else if (recData?.requesterId) {
        const user = client.users.cache.get(recData.requesterId);
        requester = user ? user.tag : `<@${recData.requesterId}>`;
      } else if (player.get('autoplay')) {
        requester = `${getEmoji('autoplay', client) || '📻'} Autoplay`;
      }

      const gEmoji = (key) => { const e = getEmoji(key, client); return e ? `${e} ` : ''; };

      const embed = new EmbedBuilder()
        .setTitle(`${gEmoji('now_playing')}Now Playing`)
        .setDescription(`[${track.info.title}](${track.info.uri || ''})`)
        .addFields(
          { name: `${gEmoji('artist')}Author / Artist`, value: `\`${track.info.author || 'Unknown'}\``, inline: true },
          { name: `${gEmoji('duration')}Duration`, value: `\`${durationStr}\``, inline: true },
          { name: `${gEmoji('user')}Requested By`, value: requester, inline: true }
        )
        .setColor(0x5865F2);

      if (track.info.artworkUrl) {
        embed.setThumbnail(track.info.artworkUrl);
      }

      try {
        const msg = await channel.send({ embeds: [embed] });
        player.nowPlayingMessage = msg;
        player.nowPlayingMessageId = msg.id;
        if (typeof player.set === 'function') {
          try { player.set('nowPlayingMessageId', msg.id); } catch {}
        }
      } catch (err) {
        logger.warn(`Failed to send Now Playing message in guild ${player.guildId}`, { error: err.message });
      }
    }).catch((err) => {
      logger.error(`Error in Now Playing message queue for guild ${player.guildId}:`, err);
    });

    await player._npQueue;

    // Pre-fetch next autoplay recommendation if queue is empty
    if (getAutoplayState(player) && player.queue.tracks.length === 0) {
      RecommendationEngine.getRecommendation(player, track)
        .then((recTrack) => {
          if (recTrack && player.queue.tracks.length === 0) {
            recTrack.userData = { requesterTag: 'Autoplay', requesterId: client.user.id };
            player.queue.add(recTrack);
            SessionPersistence.saveSnapshot(player, false);
            logger.info(`[Autoplay] Pre-fetched next recommended track for guild ${player.guildId}: "${recTrack.info.title}"`);
          }
        })
        .catch((err) => {
          logger.warn(`[Autoplay] Failed to pre-fetch track for guild ${player.guildId}:`, { error: err.message });
        });
    }
  });

  // Helper to process autoplay recommendations safely without race conditions
  const triggerAutoplayIfNeeded = async (player, lastTrack = null) => {
    if (!getAutoplayState(player)) return false;
    if (player.queue.tracks.length > 0) return false;
    if (player._isAutoplayResolving) return false;

    player._isAutoplayResolving = true;
    try {
      const seedTrack = lastTrack || player.queue.current || (player.queue.previous && player.queue.previous[player.queue.previous.length - 1]);
      logger.info(`[Autoplay] Queue empty for guild ${player.guildId}. Searching autoplay recommendation...`);
      const recTrack = await RecommendationEngine.getRecommendation(player, seedTrack);
      if (recTrack && player.queue.tracks.length === 0) {
        recTrack.userData = { requesterTag: 'Autoplay', requesterId: client.user.id };
        player.queue.add(recTrack);
        SessionPersistence.saveSnapshot(player, true);
        if (!player.playing && !player.paused) {
          player.queue.current = null;
          await player.play();
        }
        return true;
      }
    } catch (err) {
      logger.error(`[Autoplay] Error processing autoplay in guild ${player.guildId}:`, { error: err.message });
    } finally {
      player._isAutoplayResolving = false;
    }
    return false;
  };

  lavalink.on('trackEnd', async (player, track, reason) => {
    logger.debug(`[Player] Track ended in guild ${player.guildId}. Reason: ${reason?.type || reason}`);
    await deleteNowPlayingMessage(player, client);
    SessionPersistence.saveSnapshot(player, true);

    playbackEventEmitter.emitEvent('TRACK_END', {
      guildId: player.guildId,
      userId: track?.userData?.requesterId || null,
      playerId: player.guildId,
      trackId: track?.info?.identifier || 'unknown',
      metadata: {
        title: track?.info?.title,
        duration: track?.info?.duration,
        reason: reason?.type || reason,
      },
    });

    if (player.queue.tracks.length === 0) {
      await triggerAutoplayIfNeeded(player, track);
    }
  });

  lavalink.on('queueEnd', async (player) => {
    logger.info(`[Queue] Queue ended for guild ${player.guildId}`);
    await deleteNowPlayingMessage(player, client);

    const autoplayHandled = await triggerAutoplayIfNeeded(player);
    if (autoplayHandled) return;

    const guildRepo = require('../../database/repositories/guildRepository');
    const guildSettings = await guildRepo.getGuildSettings(player.guildId);
    const is247 = player.get('twentyFourSeven') || player.twentyFourSeven || guildSettings?.musicSettings?.twentyFourSeven;

    if (is247) {
      logger.info(`[Queue] 24/7 mode enabled for guild ${player.guildId}. Remaining in voice channel.`);
      return;
    }

    setTimeout(async () => {
      const activePlayer = client.lavalink?.players.get(player.guildId);
      if (activePlayer && !activePlayer.playing && activePlayer.queue.tracks.length === 0) {
        const currentSettings = await guildRepo.getGuildSettings(player.guildId);
        const recheck247 = activePlayer.get('twentyFourSeven') || activePlayer.twentyFourSeven || currentSettings?.musicSettings?.twentyFourSeven;
        if (!recheck247) {
          logger.info(`[Queue] Auto-leaving voice channel due to idle queue (Guild: ${player.guildId})`);
          await activePlayer.destroy();
        }
      }
    }, 180000);
  });

  // Track error handler: handle stream failure cleanly and prevent bouncing loops
  lavalink.on('trackError', async (player, track, payload) => {
    const errorMsg = payload?.error || payload?.exception?.message || 'Playback stream error';
    logger.error(`[Player] Track error on ${track?.info?.title} (guild ${player.guildId}):`, { error: errorMsg });
    await deleteNowPlayingMessage(player, client);

    player._trackErrorCount = (player._trackErrorCount || 0) + 1;

    const guildObj = client.guilds.cache.get(player.guildId);
    WebhookLogger.sendMusicLog({
      event: 'TRACK_ERROR',
      player: {
        ...player,
        guildName: guildObj?.name || `Guild ${player.guildId}`,
      },
      track,
      error: { message: errorMsg },
    });

    const trackTitle = track?.info?.title || 'Unknown Track';
    const textChannelId = player.textChannelId;

    let resolvedTrack = null;

    // Only attempt re-resolution if error count is under threshold (prevents infinite loops)
    if (player._trackErrorCount <= 2) {
      try {
        const cleanTitle = (track?.info?.title || '').replace(/[\(\[\{].*?[\)\]\}]/g, '').trim();
        // If track failed on YouTube, prefer SoundCloud to avoid repeating YouTube stream errors
        const isYt = (track?.info?.sourceName || '').includes('youtube') || (track?.info?.uri || '').includes('youtube');
        const sourcesToTry = isYt ? ['soundcloud'] : ['soundcloud', 'ytsearch'];

        for (const src of sourcesToTry) {
          try {
            const TrackResolver = require('../resolver/TrackResolver');
            const res = await TrackResolver.resolve(player, { query: cleanTitle, source: src }, track?.userData || { id: client.user.id, tag: 'AutoRecovery' });
            if (res && res.tracks && res.tracks.length > 0) {
              const valid = res.tracks.find(t => t.info?.uri !== track?.info?.uri) || res.tracks[0];
              if (valid) {
                resolvedTrack = valid;
                resolvedTrack.userData = track?.userData || {
                  requesterId: client.user.id,
                  requesterTag: 'AutoRecovery',
                };
                break;
              }
            }
          } catch (srcErr) {}
        }
      } catch (e) {
        logger.warn(`[Player] Fallback resolution failed: ${e.message}`);
      }
    }

    if (resolvedTrack) {
      logger.info(`[Player] Re-resolved broken track "${trackTitle}" to alternative version "${resolvedTrack.info.title}" (${resolvedTrack.info.sourceName}). Resuming playback...`);
      player.queue.current = resolvedTrack;
      await player.play();
      return;
    }

    // Reset error count after exhausting fallbacks
    player._trackErrorCount = 0;

    // Notify user of blocked YouTube stream and continue queue without looping
    if (textChannelId) {
      const channel = client.channels.cache.get(textChannelId);
      if (channel) {
        const warnEmoji = getEmoji('warning', client) || getEmoji('error', client);
        const embed = new EmbedBuilder()
          .setTitle(`${warnEmoji ? `${warnEmoji} ` : ''}Audio Stream Unavailable`)
          .setDescription(`Track **[${trackTitle}](${track?.info?.uri || ''})** is blocked or restricted by provider. Proceeding to next track...`)
          .setColor(0xFEE75C);
        channel.send({ embeds: [embed] }).then((msg) => {
          setTimeout(() => msg.delete().catch(() => {}), 8000);
        }).catch(() => {});
      }
    }

    // Skip broken track to next in queue
    if (player.queue.tracks.length > 0) {
      await player.skip();
    } else {
      await triggerAutoplayIfNeeded(player, track);
    }
  });

  lavalink.on('trackStuck', async (player, track, payload) => {
    logger.warn(`[Player] Track stuck in guild ${player.guildId} (Threshold: ${payload?.thresholdMs}ms). Skipping to next...`);
    if (player.queue.tracks.length > 0) {
      await player.skip();
    }
  });

  lavalink.on('playerDestroy', async (player) => {
    logger.debug(`[Player] Player destroyed in guild ${player.guildId}`);
    if (player.voiceChannelId) {
      updateVoiceChannelStatus(client, player.voiceChannelId, '');
    }
    await deleteNowPlayingMessage(player, client);
    SessionPersistence.deleteSession(player.guildId).catch(() => {});
  });

  lavalink.on('queueEnd', async (player) => {
    logger.debug(`[Player] Queue ended in guild ${player.guildId}`);
    if (player.voiceChannelId) {
      updateVoiceChannelStatus(client, player.voiceChannelId, '');
    }
    await deleteNowPlayingMessage(player, client);
    SessionPersistence.saveSnapshot(player, true, 'IDLE');
  });

  client.lavalink = lavalink;
  client.on('raw', (d) => lavalink.sendRawData(d));

  return lavalink;
};

module.exports = {
  initLavalink,
};
