const CustomError = require('../../utils/CustomError');
const logger = require('../../logger/logger');
const { NodeHealthMonitor } = require('../failover/NodeHealthMonitor');

class TrackResolver {
  /**
   * Helper to perform search with a timeout on a specific node or player
   */
  static async searchWithTimeout(target, queryObj, requester, timeoutMs = 6000) {
    return Promise.race([
      target.search(queryObj, requester),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error(`Search timeout after ${timeoutMs}ms on node ${target.id || 'player'}`)), timeoutMs)
      ),
    ]);
  }

  /**
   * Get sorted list of available search targets across the cluster
   */
  static getAvailableNodes(playerOrLavalink) {
    const lavalink = playerOrLavalink.LavalinkManager || playerOrLavalink.lavalink || playerOrLavalink;
    const nodes = [];

    // If player has a connected node, put it first if healthy
    if (playerOrLavalink.node && playerOrLavalink.node.connected && NodeHealthMonitor.isNodeUsable(playerOrLavalink.node.id)) {
      nodes.push(playerOrLavalink.node);
    }

    if (lavalink?.nodeManager?.nodes) {
      for (const node of lavalink.nodeManager.nodes.values()) {
        if (node.connected && !nodes.some((n) => n.id === node.id) && NodeHealthMonitor.isNodeUsable(node.id)) {
          nodes.push(node);
        }
      }
    }

    // Fallback: any connected node
    if (nodes.length === 0 && lavalink?.nodeManager?.nodes) {
      for (const node of lavalink.nodeManager.nodes.values()) {
        if (node.connected && !nodes.some((n) => n.id === node.id)) {
          nodes.push(node);
        }
      }
    }

    return nodes;
  }

  /**
   * Extract 11-character YouTube Video ID from any YouTube URL format.
   */
  static extractYouTubeVideoId(url) {
    if (!url || typeof url !== 'string') return null;
    const match = url.match(/(?:v=|\/shorts\/|\/live\/|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
    return match ? match[1] : null;
  }

  /**
   * Normalize YouTube URLs to canonical watch?v= format for maximum Lavalink compatibility.
   * Converts: youtu.be/ID, /shorts/ID, /live/ID → youtube.com/watch?v=ID
   */
  static normalizeYouTubeUrl(url) {
    // youtu.be/VIDEO_ID → youtube.com/watch?v=VIDEO_ID (preserve ?t= timestamp)
    const shortMatch = url.match(/youtu\.be\/([a-zA-Z0-9_-]{11})(\?[^#]*)?/);
    if (shortMatch) {
      const vid = shortMatch[1];
      const params = new URLSearchParams(shortMatch[2] ? shortMatch[2].slice(1) : '');
      const t = params.get('t');
      return t
        ? `https://www.youtube.com/watch?v=${vid}&t=${t}`
        : `https://www.youtube.com/watch?v=${vid}`;
    }
    // /shorts/VIDEO_ID → watch?v=VIDEO_ID
    const shortsMatch = url.match(/youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/);
    if (shortsMatch) return `https://www.youtube.com/watch?v=${shortsMatch[1]}`;
    // /live/VIDEO_ID → watch?v=VIDEO_ID
    const liveMatch = url.match(/youtube\.com\/live\/([a-zA-Z0-9_-]{11})/);
    if (liveMatch) return `https://www.youtube.com/watch?v=${liveMatch[1]}`;
    return url;
  }

  /**
   * Resolve a query or URL into playable Lavalink tracks
   * @param {Object} playerOrLavalink - Player instance or LavalinkManager instance
   * @param {string} query - URL or text query
   * @param {Object} requester - User object requesting the track
   * @returns {Promise<{ tracks: Array, type: string, playlistName?: string }>}
   */
  static async resolve(playerOrLavalink, query, requester) {
    if (!query || typeof query !== 'string') {
      throw new CustomError('INVALID_QUERY', 'Please provide a valid song name or URL.');
    }

    let trimmedQuery = query.trim();

    // Strip Discord angle-bracket URL suppression: <https://...> → https://...
    if (trimmedQuery.startsWith('<') && trimmedQuery.endsWith('>')) {
      trimmedQuery = trimmedQuery.slice(1, -1).trim();
    }

    // Strip YouTube share tracking parameter (?si=... or &si=...) to avoid resolve failures
    trimmedQuery = trimmedQuery.replace(/([?&])si=[^&]*/g, (match, sep) => sep === '?' ? '' : '').replace(/[?&]$/, '');

    let searchSource = 'ytsearch'; // Default search platform is YouTube search (ytsearch)
    let isYouTubeUrl = false;

    // Prefix & platform detection
    if (trimmedQuery.startsWith('ytsearch:')) {
      searchSource = 'ytsearch';
      trimmedQuery = trimmedQuery.slice(9).trim();
    } else if (trimmedQuery.startsWith('ytmsearch:')) {
      searchSource = 'ytsearch'; // Replace ytmsearch with ytsearch as requested
      trimmedQuery = trimmedQuery.slice(10).trim();
    } else if (trimmedQuery.startsWith('scsearch:') || trimmedQuery.startsWith('soundcloud:')) {
      searchSource = 'soundcloud';
      trimmedQuery = trimmedQuery.replace(/^(scsearch|soundcloud):/, '').trim();
    } else if (trimmedQuery.includes('soundcloud.com')) {
      searchSource = 'soundcloud';
    } else if (trimmedQuery.includes('youtube.com') || trimmedQuery.includes('music.youtube.com') || trimmedQuery.includes('youtu.be')) {
      // Normalize to canonical youtube.com/watch?v= format for Lavalink compatibility
      trimmedQuery = this.normalizeYouTubeUrl(trimmedQuery);
      searchSource = undefined; // Direct YouTube URL
      isYouTubeUrl = true;
    } else if (/^https?:\/\//i.test(trimmedQuery)) {
      searchSource = undefined; // Direct URL
    }

    const candidateNodes = this.getAvailableNodes(playerOrLavalink);
    if (candidateNodes.length === 0) {
      throw new CustomError('NODE_UNAVAILABLE', 'No active Lavalink node available in cluster to process search.');
    }

    const queriesToTry = [];
    if (searchSource) {
      if (searchSource === 'ytsearch') {
        // Fallback order: ytsearch -> soundcloud
        queriesToTry.push({ query: trimmedQuery, source: 'ytsearch' });
        queriesToTry.push({ query: trimmedQuery, source: 'soundcloud' });
      } else if (searchSource === 'soundcloud') {
        queriesToTry.push({ query: trimmedQuery, source: 'soundcloud' });
        queriesToTry.push({ query: trimmedQuery, source: 'ytsearch' });
      } else {
        queriesToTry.push({ query: trimmedQuery, source: searchSource });
        queriesToTry.push({ query: trimmedQuery, source: 'ytsearch' });
        queriesToTry.push({ query: trimmedQuery, source: 'soundcloud' });
      }
    } else {
      // Direct URL (no searchSource)
      queriesToTry.push({ query: trimmedQuery });
      // For YouTube URLs: add video ID search fallbacks in case direct URL load is blocked/fails on the node
      if (isYouTubeUrl) {
        const videoId = this.extractYouTubeVideoId(trimmedQuery);
        if (videoId) {
          queriesToTry.push({ query: videoId, source: 'ytsearch' });
          queriesToTry.push({ query: videoId, source: 'soundcloud' });
        } else {
          queriesToTry.push({ query: trimmedQuery, source: 'ytsearch' });
        }
      }
    }

    let lastError = null;

    // Loop through candidate nodes in cluster
    for (const targetNode of candidateNodes) {
      for (const searchQuery of queriesToTry) {
        try {
          logger.debug(`[TrackResolver] Trying node ${targetNode.id} with query:`, searchQuery);
          const res = await this.searchWithTimeout(targetNode, searchQuery, requester, 6000);

          if (res && res.tracks && res.tracks.length > 0 && res.loadType !== 'empty' && res.loadType !== 'error') {
            // Attach requester info to tracks
            res.tracks.forEach((track) => {
              track.userData = {
                requesterId: requester?.id || null,
                requesterTag: requester?.tag || requester?.username || 'Unknown',
              };
            });

            // Assign this healthy working node to the player if needed
            if (playerOrLavalink.guildId && playerOrLavalink.node?.id !== targetNode.id) {
              try {
                if (typeof playerOrLavalink.changeNode === 'function') {
                  await playerOrLavalink.changeNode(targetNode.id, false);
                } else {
                  playerOrLavalink.node = targetNode;
                }
              } catch (e) {
                playerOrLavalink.node = targetNode;
              }
            }

            return {
              tracks: res.tracks,
              type: res.loadType === 'playlist' ? 'PLAYLIST' : 'TRACK',
              playlistName: res.playlist?.name,
            };
          }
        } catch (nodeErr) {
          lastError = nodeErr;
          logger.warn(`[TrackResolver] Search failed on node ${targetNode.id} (${searchQuery.source || 'url'}): ${nodeErr.message}`);
          NodeHealthMonitor.recordNodeError(targetNode.id, nodeErr);
        }
      }
    }

    if (lastError) {
      logger.error(`[TrackResolver] All nodes failed resolving "${query}": ${lastError.message}`);
    }

    throw new CustomError(
      'TRACK_NOT_FOUND',
      `No results found for "${trimmedQuery}". Please try another keyword or direct link.`
    );
  }
}

module.exports = TrackResolver;
