const playerSessionRepo = require('../../database/repositories/playerSessionRepository');
const logger = require('../../logger/logger');

class SessionPersistence {
  constructor() {
    this.inMemorySessions = new Map();
    this.debounceTimers = new Map();
    this.debounceDelayMs = 2500; // 2.5s debounce delay for throttled writes
    this.periodicSyncInterval = null;
  }

  /**
   * Initialize periodic syncing and cleanup
   */
  start(client, intervalMs = 5000) {
    if (this.periodicSyncInterval) clearInterval(this.periodicSyncInterval);

    this.periodicSyncInterval = setInterval(() => {
      this.syncActivePlayerPositions(client);
    }, intervalMs);

    // Run stale session cleanup every 6 hours
    setInterval(() => {
      playerSessionRepo.cleanupStaleSessions(24 * 60 * 60 * 1000).catch(() => {});
    }, 6 * 60 * 60 * 1000);
  }

  stop() {
    if (this.periodicSyncInterval) {
      clearInterval(this.periodicSyncInterval);
      this.periodicSyncInterval = null;
    }
    // Clear all pending debounce timers
    for (const timer of this.debounceTimers.values()) {
      clearTimeout(timer);
    }
    this.debounceTimers.clear();
  }

  /**
   * Helper to format a track object for storage
   */
  formatTrack(track) {
    if (!track) return null;
    return {
      encoded: track.encoded || track.track || null,
      identifier: track.info?.identifier || track.identifier || null,
      title: track.info?.title || track.title || 'Unknown Title',
      author: track.info?.author || track.author || 'Unknown Artist',
      source: track.info?.sourceName || track.source || 'youtube',
      uri: track.info?.uri || track.uri || null,
      duration: track.info?.duration || track.duration || 0,
      artworkUrl: track.info?.artworkUrl || track.artworkUrl || null,
      isStream: track.info?.isStream || track.isStream || false,
      isSeekable: track.info?.isSeekable !== undefined ? track.info.isSeekable : true,
      userData: {
        requesterId: track.userData?.requesterId || null,
        requesterTag: track.userData?.requesterTag || null,
      },
    };
  }

  /**
   * Extract player snapshot
   */
  extractSnapshot(player, customStatus = null) {
    if (!player || !player.guildId) return null;

    const currentTrack = player.queue.current ? this.formatTrack(player.queue.current) : null;
    // Limit queue size stored in DB (max 150 tracks) to avoid bloating MongoDB documents
    const rawQueue = Array.isArray(player.queue.tracks) ? player.queue.tracks.slice(0, 150) : [];
    const queueTracks = rawQueue.map((t) => this.formatTrack(t)).filter(Boolean);

    // Limit previous tracks history stored in DB (max 25 tracks)
    const rawPrevious = Array.isArray(player.queue.previous) ? player.queue.previous.slice(-25) : [];
    const previousTracks = rawPrevious.map((t) => this.formatTrack(t)).filter(Boolean);

    let status = customStatus;
    if (!status) {
      if (player.playing) status = 'PLAYING';
      else if (player.paused) status = 'PAUSED';
      else status = 'IDLE';
    }

    const stored = this.inMemorySessions.get(player.guildId);
    const voiceChannelId = player.voiceChannelId || (typeof player.get === 'function' ? player.get('voiceChannelId') : null) || stored?.voiceChannelId || null;
    const textChannelId = player.textChannelId || (typeof player.get === 'function' ? player.get('textChannelId') : null) || stored?.textChannelId || null;

    if (player.voiceChannelId && typeof player.set === 'function') {
      try { player.set('voiceChannelId', player.voiceChannelId); } catch {}
    }
    if (player.textChannelId && typeof player.set === 'function') {
      try { player.set('textChannelId', player.textChannelId); } catch {}
    }

    return {
      guildId: player.guildId,
      voiceChannelId,
      textChannelId,
      nodeId: player.node?.id || null,
      currentTrack,
      position: player.position || 0,
      positionUpdatedAt: new Date(),
      queue: queueTracks,
      previousTracks,
      currentIndex: 0,
      volume: player.volume || 100,
      filters: player.filterManager?.data || {},
      repeatMode: player.repeatMode || 'off',
      shuffle: false,
      autoplay: Boolean(player.get('autoplay')),
      nowPlayingMessageId: player.nowPlayingMessageId || (typeof player.get === 'function' ? player.get('nowPlayingMessageId') : null) || null,
      status,
      lastHeartbeat: new Date(),
    };
  }

  /**
   * Update memory session and trigger debounced persist to MongoDB
   */
  saveSnapshot(player, immediate = false, customStatus = null) {
    if (!player || !player.guildId) return;

    const snapshot = this.extractSnapshot(player, customStatus);
    if (!snapshot) return;

    this.inMemorySessions.set(player.guildId, snapshot);

    if (immediate) {
      this.cancelDebounce(player.guildId);
      playerSessionRepo.saveSession(snapshot).catch((err) => {
        logger.error(`[SessionPersistence] Immediate save failed for ${player.guildId}:`, {
          error: err.message,
        });
      });
      return;
    }

    // Debounced write
    this.scheduleDebouncedSave(player.guildId, snapshot);
  }

  scheduleDebouncedSave(guildId, snapshot) {
    this.cancelDebounce(guildId);

    const timer = setTimeout(() => {
      this.debounceTimers.delete(guildId);
      playerSessionRepo.saveSession(snapshot).catch((err) => {
        logger.warn(`[SessionPersistence] Debounced save failed for ${guildId}:`, {
          error: err.message,
        });
      });
    }, this.debounceDelayMs);

    this.debounceTimers.set(guildId, timer);
  }

  cancelDebounce(guildId) {
    if (this.debounceTimers.has(guildId)) {
      clearTimeout(this.debounceTimers.get(guildId));
      this.debounceTimers.delete(guildId);
    }
  }

  /**
   * Get cached session or fallback to DB
   */
  async getSession(guildId) {
    if (this.inMemorySessions.has(guildId)) {
      return this.inMemorySessions.get(guildId);
    }
    const dbSession = await playerSessionRepo.getSession(guildId);
    if (dbSession) {
      this.inMemorySessions.set(guildId, dbSession);
    }
    return dbSession;
  }

  /**
   * Remove session when player is gracefully stopped / idle
   */
  async deleteSession(guildId) {
    this.cancelDebounce(guildId);
    this.inMemorySessions.delete(guildId);
    await playerSessionRepo.deleteSession(guildId);
  }

  /**
   * Update position only (lightweight update)
   */
  updatePosition(guildId, position) {
    if (!guildId) return;
    const session = this.inMemorySessions.get(guildId);
    if (session) {
      session.position = position;
      session.positionUpdatedAt = new Date();
    }
  }

  /**
   * Periodic position sync for all active players
   */
  syncActivePlayerPositions(client) {
    if (!client.lavalink) return;

    for (const player of client.lavalink.players.values()) {
      if (player.playing && player.queue.current) {
        this.updatePosition(player.guildId, player.position || 0);

        const snapshot = this.extractSnapshot(player);
        if (snapshot) {
          this.inMemorySessions.set(player.guildId, snapshot);
          // Debounce the DB write so we don't spam MongoDB every tick
          this.scheduleDebouncedSave(player.guildId, snapshot);
        }
      }
    }
  }

  /**
   * Persist all active sessions immediately (e.g., during graceful shutdown)
   */
  async persistAllImmediate(client, reason = 'SAVED_FOR_RESTART') {
    if (!client.lavalink) return;

    logger.info(`[SessionPersistence] Flushing all active player sessions immediately (Reason: ${reason})...`);

    const promises = [];
    for (const player of client.lavalink.players.values()) {
      if (player.queue.current || (player.queue.tracks && player.queue.tracks.length > 0)) {
        const snapshot = this.extractSnapshot(player, reason);
        if (snapshot) {
          this.inMemorySessions.set(player.guildId, snapshot);
          promises.push(playerSessionRepo.saveSession(snapshot));
        }
      }
    }

    await Promise.allSettled(promises);
    logger.info(`[SessionPersistence] Successfully persisted ${promises.length} active sessions to MongoDB.`);
  }
}

module.exports = new SessionPersistence();
