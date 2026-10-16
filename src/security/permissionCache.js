/**
 * Isolated Permission Cache with TTL and fine-grained invalidation
 */

class PermissionCache {
  constructor(defaultTtlMs = 60000) {
    // Isolated nested Map: Map<guildId, Map<userId, { permissions: Set<string>, expiresAt: number }>>
    this.cache = new Map();
    this.defaultTtlMs = defaultTtlMs;
  }

  /**
   * Get cached permission decision
   * @param {string} guildId
   * @param {string} userId
   * @param {string} permissionNode
   * @returns {boolean|null} true/false if cached, null if cache miss
   */
  get(guildId, userId, permissionNode) {
    const guildCache = this.cache.get(guildId);
    if (!guildCache) return null;

    const userEntry = guildCache.get(userId);
    if (!userEntry) return null;

    if (Date.now() > userEntry.expiresAt) {
      guildCache.delete(userId);
      return null;
    }

    if (userEntry.denied?.has(permissionNode) || userEntry.denied?.has('*')) {
      return false;
    }

    if (userEntry.allowed?.has(permissionNode) || userEntry.allowed?.has('*')) {
      return true;
    }

    return null;
  }

  /**
   * Set cached permission entry
   * @param {string} guildId
   * @param {string} userId
   * @param {Set<string>} allowed
   * @param {Set<string>} denied
   * @param {number} [ttlMs]
   */
  set(guildId, userId, allowed = new Set(), denied = new Set(), ttlMs = this.defaultTtlMs) {
    if (!this.cache.has(guildId)) {
      this.cache.set(guildId, new Map());
    }

    const guildCache = this.cache.get(guildId);
    guildCache.set(userId, {
      allowed,
      denied,
      expiresAt: Date.now() + ttlMs,
    });
  }

  /**
   * Invalidate specific user cache in a guild
   * @param {string} guildId
   * @param {string} userId
   */
  invalidateUser(guildId, userId) {
    const guildCache = this.cache.get(guildId);
    if (guildCache) {
      guildCache.delete(userId);
    }
  }

  /**
   * Invalidate all users in a guild (e.g. when guild roles/settings change)
   * @param {string} guildId
   */
  invalidateGuild(guildId) {
    this.cache.delete(guildId);
  }

  /**
   * Clear entire cache
   */
  clearAll() {
    this.cache.clear();
  }
}

module.exports = new PermissionCache();
