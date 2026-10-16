const crypto = require('crypto');
const SecurityAudit = require('../database/models/SecurityAudit');
const SecretRedaction = require('./secretRedaction');
const logger = require('../logger/logger');

class AuditLogger {
  /**
   * Record a security-sensitive action to the audit collection
   * @param {Object} options
   * @param {string} options.actorId - User ID performing action
   * @param {string} [options.guildId] - Guild context
   * @param {string} options.action - Action name (e.g. 'PERMISSION_CHANGED', 'PLAYLIST_DELETED')
   * @param {string} [options.target] - Target entity (e.g. role ID, playlist ID)
   * @param {Object} [options.metadata] - Context data (will be automatically sanitized)
   * @param {string} [options.ip] - Source IP if applicable
   * @param {'SUCCESS'|'DENIED'|'FAILED'|'ERROR'} [options.result]
   */
  static async log({ actorId, guildId = null, action, target = null, metadata = {}, ip = null, result = 'SUCCESS' }) {
    const eventId = `audit-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
    const sanitizedMetadata = SecretRedaction.sanitize(metadata);

    try {
      const entry = new SecurityAudit({
        eventId,
        actorId,
        guildId,
        action,
        target,
        metadata: sanitizedMetadata,
        ip,
        result,
      });

      await entry.save();
      logger.info(`[SecurityAudit] [${action}] by ${actorId} (${result})`, { eventId, target });
      return entry;
    } catch (err) {
      logger.error(`[SecurityAudit] Failed to record audit log: ${err.message}`);
      return null;
    }
  }
}

module.exports = AuditLogger;
