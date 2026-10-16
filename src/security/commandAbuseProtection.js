/**
 * Command Abuse & Rate Limiting Protection Subsystem
 */

class CommandAbuseProtection {
  constructor() {
    // Map<userId:actionKey, { timestamps: number[], blockedUntil: number }>
    this.buckets = new Map();
    this.limits = {
      command_rate: { max: 5, windowMs: 5000, blockDurationMs: 15000 },
      failed_commands: { max: 4, windowMs: 10000, blockDurationMs: 30000 },
      search_requests: { max: 6, windowMs: 10000, blockDurationMs: 20000 },
      queue_mutations: { max: 8, windowMs: 10000, blockDurationMs: 20000 },
    };
  }

  /**
   * Check if action is rate-limited
   * @param {string} userId
   * @param {'command_rate'|'failed_commands'|'search_requests'|'queue_mutations'} actionType
   * @returns {{ limited: boolean, retryAfterMs: number }}
   */
  check(userId, actionType = 'command_rate') {
    const key = `${userId}:${actionType}`;
    const now = Date.now();
    const config = this.limits[actionType] || this.limits.command_rate;

    let bucket = this.buckets.get(key);
    if (!bucket) {
      bucket = { timestamps: [], blockedUntil: 0 };
      this.buckets.set(key, bucket);
    }

    // Check existing block
    if (bucket.blockedUntil > now) {
      return { limited: true, retryAfterMs: bucket.blockedUntil - now };
    }

    // Prune expired timestamps
    bucket.timestamps = bucket.timestamps.filter((ts) => now - ts < config.windowMs);

    // Check threshold
    if (bucket.timestamps.length >= config.max) {
      bucket.blockedUntil = now + config.blockDurationMs;
      return { limited: true, retryAfterMs: config.blockDurationMs };
    }

    // Record attempt
    bucket.timestamps.push(now);
    return { limited: false, retryAfterMs: 0 };
  }

  /**
   * Record a failed command for repeated failure detection
   */
  recordFailure(userId) {
    return this.check(userId, 'failed_commands');
  }

  /**
   * Clear rate limit bucket for a user
   */
  reset(userId, actionType = null) {
    if (actionType) {
      this.buckets.delete(`${userId}:${actionType}`);
    } else {
      for (const key of this.buckets.keys()) {
        if (key.startsWith(`${userId}:`)) {
          this.buckets.delete(key);
        }
      }
    }
  }
}

module.exports = new CommandAbuseProtection();
