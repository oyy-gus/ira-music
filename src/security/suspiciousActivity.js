const SecurityEvent = require('../database/models/SecurityEvent');
const logger = require('../logger/logger');

class SuspiciousActivityDetector {
  constructor() {
    this.userActionWindows = new Map();
  }

  /**
   * Log and evaluate potentially suspicious user actions
   * @param {Object} param0
   */
  static async recordEvent({ userId, guildId, eventType, command, metadata = {}, severity = 'LOW' }) {
    try {
      logger.warn(`[SecurityDetector] ${eventType} detected from user ${userId} in guild ${guildId}`, {
        command,
        severity,
      });

      const event = new SecurityEvent({
        userId,
        guildId,
        eventType,
        command,
        metadata,
        severity,
        status: severity === 'CRITICAL' || severity === 'HIGH' ? 'ESCALATED' : 'DETECTED',
      });

      await event.save();
      return event;
    } catch (err) {
      logger.error(`[SecurityDetector] Failed to persist security event: ${err.message}`);
      return null;
    }
  }

  /**
   * Check if user activity window indicates abnormal behavior
   * @param {string} userId
   * @param {string} guildId
   * @param {string} activityType
   */
  static async trackActivity(userId, guildId, activityType, command = '') {
    if (activityType === 'PERMISSION_DENIED_BURST') {
      await this.recordEvent({
        userId,
        guildId,
        eventType: 'PERMISSION_DENIED_BURST',
        command,
        severity: 'MEDIUM',
      });
    } else if (activityType === 'COMMAND_SPAM') {
      await this.recordEvent({
        userId,
        guildId,
        eventType: 'COMMAND_SPAM',
        command,
        severity: 'LOW',
      });
    }
  }
}

module.exports = SuspiciousActivityDetector;
