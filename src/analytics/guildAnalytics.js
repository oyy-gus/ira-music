const AnalyticsEvent = require('../database/models/AnalyticsEvent');

class GuildAnalytics {
  /**
   * Helper to get start Date from range string
   */
  static getRangeDate(range) {
    const now = Date.now();
    switch (range) {
      case '24h':
        return new Date(now - 24 * 3600 * 1000);
      case '7d':
        return new Date(now - 7 * 24 * 3600 * 1000);
      case '30d':
        return new Date(now - 30 * 24 * 3600 * 1000);
      case '90d':
        return new Date(now - 90 * 24 * 3600 * 1000);
      case '1y':
        return new Date(now - 365 * 24 * 3600 * 1000);
      case 'all-time':
      default:
        return new Date(0);
    }
  }

  /**
   * Aggregate guild analytics
   * @param {string} guildId
   * @param {'24h'|'7d'|'30d'|'90d'|'1y'|'all-time'} range
   */
  static async getGuildStats(guildId, range = '7d') {
    const startDate = this.getRangeDate(range);

    const matchStage = {
      guildId,
      timestamp: { $gte: startDate },
    };

    const [eventsSummary, topTracks, topArtists, uniqueUsers] = await Promise.all([
      // Total counts by event type
      AnalyticsEvent.aggregate([
        { $match: matchStage },
        {
          $group: {
            _id: '$eventType',
            count: { $sum: 1 },
            totalDuration: { $sum: { $ifNull: ['$metadata.duration', 0] } },
          },
        },
      ]),

      // Top tracks played
      AnalyticsEvent.aggregate([
        { $match: { ...matchStage, eventType: 'TRACK_START' } },
        {
          $group: {
            _id: '$metadata.title',
            author: { $first: '$metadata.author' },
            playCount: { $sum: 1 },
          },
        },
        { $sort: { playCount: -1 } },
        { $limit: 10 },
      ]),

      // Top artists
      AnalyticsEvent.aggregate([
        { $match: { ...matchStage, eventType: 'TRACK_START', 'metadata.author': { $exists: true, $ne: '' } } },
        {
          $group: {
            _id: '$metadata.author',
            playCount: { $sum: 1 },
          },
        },
        { $sort: { playCount: -1 } },
        { $limit: 5 },
      ]),

      // Unique listening users
      AnalyticsEvent.distinct('userId', { ...matchStage, userId: { $exists: true, $ne: null } }),
    ]);

    const countsMap = {};
    let totalListeningTimeMs = 0;
    for (const item of eventsSummary) {
      countsMap[item._id] = item.count;
      if (item._id === 'TRACK_START' || item._id === 'TRACK_END') {
        totalListeningTimeMs += item.totalDuration;
      }
    }

    const totalPlays = countsMap.TRACK_START || 0;
    const totalSkips = countsMap.TRACK_SKIP || 0;
    const totalErrors = countsMap.TRACK_ERROR || 0;
    const totalRecoveries = countsMap.PLAYER_RECOVER || 0;
    const totalMigrations = countsMap.PLAYER_MIGRATE || 0;

    const skipRate = totalPlays > 0 ? ((totalSkips / totalPlays) * 100).toFixed(1) : '0.0';
    const errorRate = totalPlays > 0 ? ((totalErrors / totalPlays) * 100).toFixed(1) : '0.0';

    return {
      guildId,
      range,
      totalPlays,
      totalListeningTimeMs,
      totalListeningTimeMinutes: Math.round(totalListeningTimeMs / 60000),
      uniqueUsersCount: uniqueUsers.length,
      skipRate: `${skipRate}%`,
      errorRate: `${errorRate}%`,
      totalRecoveries,
      totalMigrations,
      topTracks: topTracks.map((t) => ({ title: t._id || 'Unknown', author: t.author || 'Unknown', plays: t.playCount })),
      topArtists: topArtists.map((a) => ({ name: a._id || 'Unknown', plays: a.playCount })),
    };
  }
}

module.exports = GuildAnalytics;
