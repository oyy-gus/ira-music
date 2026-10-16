const AnalyticsEvent = require('../database/models/AnalyticsEvent');

class TrackAnalytics {
  /**
   * Get track analytics and completion metrics
   * @param {string} trackIdentifier
   */
  static async getTrackStats(trackIdentifier) {
    const [starts, completions, skips, uniqueUsers] = await Promise.all([
      AnalyticsEvent.countDocuments({ trackId: trackIdentifier, eventType: 'TRACK_START' }),
      AnalyticsEvent.countDocuments({ trackId: trackIdentifier, eventType: 'TRACK_END' }),
      AnalyticsEvent.countDocuments({ trackId: trackIdentifier, eventType: 'TRACK_SKIP' }),
      AnalyticsEvent.distinct('userId', { trackId: trackIdentifier }),
    ]);

    const completionRate = starts > 0 ? ((completions / starts) * 100).toFixed(1) : '0.0';
    const skipRate = starts > 0 ? ((skips / starts) * 100).toFixed(1) : '0.0';

    return {
      trackId: trackIdentifier,
      totalPlays: starts,
      completions,
      skips,
      completionRate: `${completionRate}%`,
      skipRate: `${skipRate}%`,
      uniqueListeners: uniqueUsers.length,
    };
  }
}

module.exports = TrackAnalytics;
