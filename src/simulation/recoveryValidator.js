const logger = require('../logger/logger');

class RecoveryValidator {
  /**
   * Validate state of a recovered player session
   * @param {Object} player - Lavalink Player instance
   * @param {Object} expectedSnapshot - Snapshot data saved before failure
   * @returns {{ valid: boolean, errors: string[] }}
   */
  static validatePlayerRecovery(player, expectedSnapshot) {
    const errors = [];

    if (!player) {
      errors.push('Player instance missing or not created.');
      return { valid: false, errors };
    }

    if (!player.connected) {
      errors.push('Player voice connection is not active.');
    }

    if (!player.node || !player.node.connected) {
      errors.push('Player is not attached to an active Lavalink node.');
    }

    // Validate queue preservation
    if (expectedSnapshot?.queue && Array.isArray(expectedSnapshot.queue)) {
      const currentQueueLength = player.queue?.tracks?.length || 0;
      if (currentQueueLength !== expectedSnapshot.queue.length) {
        errors.push(
          `Queue loss detected: expected ${expectedSnapshot.queue.length} tracks, found ${currentQueueLength}.`
        );
      }
    }

    // Validate position recovery
    if (expectedSnapshot?.position !== undefined && expectedSnapshot.position > 0) {
      const currentPosition = player.position || 0;
      // Allow slight difference during playback resumption
      const diff = Math.abs(currentPosition - expectedSnapshot.position);
      if (diff > 15000) {
        errors.push(`Position desync: expected ~${expectedSnapshot.position}ms, actual ${currentPosition}ms.`);
      }
    }

    const isValid = errors.length === 0;
    if (!isValid) {
      logger.warn(`[RecoveryValidator] Recovery validation errors for guild ${player?.guildId}:`, errors);
    }

    return {
      valid: isValid,
      errors,
    };
  }

  /**
   * Check if duplicate players exist across the cluster
   * @param {Object} lavalink - LavalinkManager instance
   * @returns {boolean} true if no duplicates found
   */
  static validateNoDuplicatePlayers(lavalink) {
    if (!lavalink?.players) return true;
    const seenGuildIds = new Set();
    for (const [guildId] of lavalink.players) {
      if (seenGuildIds.has(guildId)) {
        return false;
      }
      seenGuildIds.add(guildId);
    }
    return true;
  }
}

module.exports = RecoveryValidator;
