const AnalyticsEvent = require('../database/models/AnalyticsEvent');
const SecurityAudit = require('../database/models/SecurityAudit');
const logger = require('../logger/logger');

class RetentionPolicy {
  /**
   * Prune events older than given days
   * @param {number} rawEventDays - Days to keep raw events (default 90)
   * @param {number} auditDays - Days to keep security audit logs (default 180)
   */
  static async pruneOldData(rawEventDays = 90, auditDays = 180) {
    const rawCutoff = new Date(Date.now() - rawEventDays * 24 * 3600 * 1000);
    const auditCutoff = new Date(Date.now() - auditDays * 24 * 3600 * 1000);

    try {
      const [eventsResult, auditResult] = await Promise.all([
        AnalyticsEvent.deleteMany({ timestamp: { $lt: rawCutoff } }),
        SecurityAudit.deleteMany({ timestamp: { $lt: auditCutoff } }),
      ]);

      logger.info('[RetentionPolicy] Pruned old analytics and audit records', {
        prunedEvents: eventsResult.deletedCount,
        prunedAudits: auditResult.deletedCount,
      });

      return {
        prunedEvents: eventsResult.deletedCount,
        prunedAudits: auditResult.deletedCount,
      };
    } catch (err) {
      logger.error(`[RetentionPolicy] Error pruning records: ${err.message}`);
      return { error: err.message };
    }
  }
}

module.exports = RetentionPolicy;
