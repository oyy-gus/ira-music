const AnalyticsEvent = require('../database/models/AnalyticsEvent');
const AnalyticsAggregate = require('../database/models/AnalyticsAggregate');
const logger = require('../logger/logger');

class AggregationWorker {
  constructor() {
    this.interval = null;
    this.intervalMs = 300000; // Run every 5 minutes
  }

  /**
   * Start periodic aggregation worker
   */
  start() {
    if (this.interval) clearInterval(this.interval);

    this.interval = setInterval(() => {
      this.runAggregation().catch((err) => {
        logger.error(`[AggregationWorker] Aggregation cycle error: ${err.message}`);
      });
    }, this.intervalMs);

    logger.info('[AggregationWorker] Analytics aggregation worker started.');
  }

  stop() {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
  }

  /**
   * Run daily rollup aggregation
   */
  async runAggregation() {
    const todayKey = new Date().toISOString().split('T')[0];
    const startOfDay = new Date();
    startOfDay.setUTCHours(0, 0, 0, 0);

    // Aggregate by guild for today
    const guildStats = await AnalyticsEvent.aggregate([
      { $match: { timestamp: { $gte: startOfDay } } },
      {
        $group: {
          _id: '$guildId',
          totalPlays: {
            $sum: { $cond: [{ $eq: ['$eventType', 'TRACK_START'] }, 1, 0] },
          },
          totalSkips: {
            $sum: { $cond: [{ $eq: ['$eventType', 'TRACK_SKIP'] }, 1, 0] },
          },
          totalErrors: {
            $sum: { $cond: [{ $eq: ['$eventType', 'TRACK_ERROR'] }, 1, 0] },
          },
          uniqueUsers: { $addToSet: '$userId' },
        },
      },
    ]);

    for (const item of guildStats) {
      if (!item._id) continue;
      await AnalyticsAggregate.findOneAndUpdate(
        {
          type: 'guild',
          targetId: item._id,
          period: 'daily',
          periodKey: todayKey,
        },
        {
          $set: {
            'stats.totalPlays': item.totalPlays,
            'stats.totalSkips': item.totalSkips,
            'stats.totalErrors': item.totalErrors,
            'stats.uniqueUsers': item.uniqueUsers.filter(Boolean),
            lastAggregatedAt: new Date(),
          },
        },
        { upsert: true }
      );
    }
  }
}

module.exports = new AggregationWorker();
