const logger = require('../../logger/logger');

class RecoveryLock {
  constructor() {
    this.locks = new Map();
    this.defaultTtlMs = 30000; // 30 seconds default lock expiration
  }

  /**
   * Attempt to acquire recovery lock for a guild
   * @param {string} guildId
   * @param {string} owner - Identifier for lock owner (e.g. migrationId / recoveryId)
   * @param {number} ttlMs - Time to live in ms
   * @returns {boolean} True if lock was acquired, false if already locked
   */
  acquire(guildId, owner = 'system', ttlMs = this.defaultTtlMs) {
    if (!guildId) return false;
    const now = Date.now();
    const existing = this.locks.get(guildId);

    if (existing) {
      if (existing.expiresAt > now) {
        if (existing.owner === owner) {
          // Re-entrant lock for same owner
          existing.expiresAt = now + ttlMs;
          return true;
        }
        logger.warn(`[RecoveryLock] Guild ${guildId} is already locked by owner ${existing.owner}. Lock request rejected for ${owner}.`);
        return false;
      }
      // Lock expired, allow takeover
      logger.info(`[RecoveryLock] Expired lock for guild ${guildId} (was ${existing.owner}) released automatically.`);
    }

    this.locks.set(guildId, {
      owner,
      acquiredAt: now,
      expiresAt: now + ttlMs,
    });

    return true;
  }

  /**
   * Release lock for a guild if owner matches or forced
   * @param {string} guildId
   * @param {string} owner
   * @param {boolean} force
   * @returns {boolean}
   */
  release(guildId, owner = null, force = false) {
    if (!guildId) return false;
    const existing = this.locks.get(guildId);
    if (!existing) return true;

    if (force || !owner || existing.owner === owner) {
      this.locks.delete(guildId);
      return true;
    }

    logger.warn(`[RecoveryLock] Cannot release lock for guild ${guildId}: owner mismatch (held by ${existing.owner}, tried by ${owner}).`);
    return false;
  }

  /**
   * Check if a guild is currently locked
   * @param {string} guildId
   * @returns {boolean}
   */
  isLocked(guildId) {
    if (!guildId) return false;
    const existing = this.locks.get(guildId);
    if (!existing) return false;

    if (existing.expiresAt <= Date.now()) {
      this.locks.delete(guildId);
      return false;
    }

    return true;
  }
}

module.exports = new RecoveryLock();
