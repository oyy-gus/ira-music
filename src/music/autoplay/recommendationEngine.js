/**
 * @file recommendationEngine.js
 * @description Simple YouTube Mix (RD{identifier}) Autoplay Engine.
 * Tracks played history per-player to avoid repeating songs.
 */

const logger = require('../../logger/logger');

// Max played history size per guild to keep memory bounded
const MAX_HISTORY = 50;

class RecommendationEngine {
  /**
   * Helper to ensure player.data supports .get() and .set() methods
   */
  static ensurePlayerData(player) {
    if (!player) return;
    if (!player.data) player.data = {};
    if (typeof player.data.get !== 'function') {
      player.data.get = function (key) { return this[key]; };
    }
    if (typeof player.data.set !== 'function') {
      player.data.set = function (key, val) { this[key] = val; };
    }
  }

  /**
   * Get or create the played history Set for this player session.
   * Stored on player._autoplayHistory to survive across calls.
   */
  static getPlayedHistory(player) {
    if (!player._autoplayHistory || !(player._autoplayHistory instanceof Set)) {
      player._autoplayHistory = new Set();

      // Seed history with already-played tracks from player.queue.previous
      if (Array.isArray(player.queue?.previous)) {
        for (const t of player.queue.previous) {
          const id = t?.info?.identifier;
          if (id) player._autoplayHistory.add(id);
        }
      }
      // Also add current playing track
      const cur = player.queue?.current;
      if (cur?.info?.identifier) player._autoplayHistory.add(cur.info.identifier);
    }
    return player._autoplayHistory;
  }

  /**
   * Record a played track identifier into the history, trim if too large.
   */
  static recordPlayed(player, identifier) {
    if (!identifier) return;
    const hist = this.getPlayedHistory(player);
    hist.add(identifier);
    // Trim oldest entries if over limit
    if (hist.size > MAX_HISTORY) {
      const first = hist.values().next().value;
      hist.delete(first);
    }
  }

  /**
   * Fisher-Yates shuffle on an array (in-place, returns array)
   */
  static shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  /**
   * Simple YouTube Mix Autoplay algorithm using https://www.youtube.com/watch?v={id}&list=RD{id}
   * Avoids repeating tracks that were already played this session.
   *
   * @param {Object} player Lavalink player instance
   * @param {Object} currentTrack Currently playing track
   * @returns {Promise<Object|null>} Next recommended track
   */
  static async getRecommendation(player, currentTrack) {
    if (!player) return null;
    this.ensurePlayerData(player);

    const isAutoplay = player.data.get('autoplay') || (typeof player.get === 'function' && player.get('autoplay'));
    if (!isAutoplay) return null;

    // Retrieve last track identifier robustly
    let lastIdentifier =
      player.data.get('identifier') ||
      currentTrack?.info?.identifier ||
      currentTrack?.identifier ||
      player.queue?.current?.info?.identifier ||
      player.current?.info?.identifier ||
      (player.queue?.previous?.length
        ? player.queue.previous[player.queue.previous.length - 1]?.info?.identifier
        : null) ||
      (typeof player.get === 'function' && player.get('identifier'));

    const requester =
      player.data.get('requester') ||
      currentTrack?.userData ||
      (typeof player.get === 'function' && player.get('requester')) ||
      { requesterTag: 'Autoplay', requesterId: 'autoplay' };

    if (!lastIdentifier && currentTrack?.info?.title) {
      lastIdentifier = currentTrack.info.title;
    }
    if (!lastIdentifier) return null;

    const playedHistory = this.getPlayedHistory(player);
    logger.debug(`[SimpleAutoplay] Played history size: ${playedHistory.size}, seed: ${lastIdentifier}`);

    try {
      // Build list of URLs/queries to try in order
      const urlsToTry = [];
      if (!lastIdentifier.startsWith('http') && !lastIdentifier.includes('watch?v=')) {
        urlsToTry.push(`https://www.youtube.com/watch?v=${lastIdentifier}&list=RD${lastIdentifier}`);
        urlsToTry.push(`https://www.youtube.com/watch?v=${lastIdentifier}`);
      } else {
        urlsToTry.push(lastIdentifier);
      }
      if (currentTrack?.info?.author && currentTrack?.info?.title) {
        urlsToTry.push(`${currentTrack.info.author} ${currentTrack.info.title}`);
      } else if (currentTrack?.info?.title) {
        urlsToTry.push(currentTrack.info.title);
      }

      let res = null;

      for (const queryTarget of urlsToTry) {
        // Try TrackResolver first for multi-node cluster awareness & fallback sources
        try {
          const TrackResolver = require('../resolver/TrackResolver');
          const resolved = await TrackResolver.resolve(player, queryTarget, requester);
          if (resolved?.tracks?.length > 0) {
            res = resolved;
          }
        } catch (e) {
          logger.debug(`[SimpleAutoplay] TrackResolver search for "${queryTarget}": ${e.message}`);
        }

        if ((!res || !res.tracks || res.tracks.length === 0) && typeof player.search === 'function') {
          try {
            const isUrl = queryTarget.startsWith('http');
            res = await player.search(
              isUrl ? queryTarget : { query: queryTarget, source: 'ytsearch' },
              requester
            );
          } catch (e) {
            logger.debug(`[SimpleAutoplay] player.search failed for "${queryTarget}": ${e.message}`);
          }
        }

        if (res?.tracks?.length > 0) {
          logger.debug(`[SimpleAutoplay] Got ${res.tracks.length} tracks from: "${queryTarget}"`);
          break;
        }
      }

      if (res?.tracks?.length > 0) {
        // Filter out: current seed track + already-played history
        let candidates = res.tracks.filter((t) => {
          const id = t.info?.identifier || t.identifier;
          return id !== lastIdentifier && !playedHistory.has(id);
        });

        // If all candidates were already played, clear history and use full list
        // (prevents infinite skip loops on small mixes)
        if (candidates.length === 0) {
          logger.info(`[SimpleAutoplay] All candidates already played — resetting session history`);
          playedHistory.clear();
          candidates = res.tracks.filter((t) => {
            const id = t.info?.identifier || t.identifier;
            return id !== lastIdentifier;
          });
        }

        // Still nothing? Use full list as last resort
        if (candidates.length === 0) candidates = res.tracks;

        // Shuffle candidates for true variety
        this.shuffle(candidates);

        const nextTrack = candidates[0];

        if (nextTrack) {
          const nextId = nextTrack.info?.identifier || nextTrack.identifier || lastIdentifier;

          // Update identifier for next cycle
          player.data.set('identifier', nextId);
          if (typeof player.set === 'function') { try { player.set('identifier', nextId); } catch { } }

          // Record this track as played
          this.recordPlayed(player, nextId);

          nextTrack.userData = requester;
          nextTrack._wasAutoplay = true;

          logger.info(`[SimpleAutoplay] Next track: "${nextTrack.info?.title}" (skipped ${playedHistory.size - 1} already-played)`);
          return nextTrack;
        }
      }
    } catch (err) {
      logger.warn(`[SimpleAutoplay] Autoplay search failed for ${lastIdentifier}: ${err.message}`);
    }

    return null;
  }

  /**
   * Alias for getRecommendation
   */
  static async getNextTrack(player, currentTrack) {
    return this.getRecommendation(player, currentTrack);
  }
}

module.exports = RecommendationEngine;
