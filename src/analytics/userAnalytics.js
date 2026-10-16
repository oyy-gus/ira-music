const AnalyticsEvent = require('../database/models/AnalyticsEvent');
const UserMusicProfile = require('../database/models/UserMusicProfile');

class UserAnalytics {
  /**
   * Get detailed analytics for a user
   * @param {string} userId
   */
  static async getUserAnalytics(userId) {
    const [profile, recentPlays, topArtists] = await Promise.all([
      UserMusicProfile.findOne({ userId }).lean(),
      AnalyticsEvent.find({ userId, eventType: 'TRACK_START' })
        .sort({ timestamp: -1 })
        .limit(10)
        .lean(),
      AnalyticsEvent.aggregate([
        { $match: { userId, eventType: 'TRACK_START', 'metadata.author': { $exists: true, $ne: '' } } },
        {
          $group: {
            _id: '$metadata.author',
            plays: { $sum: 1 },
          },
        },
        { $sort: { plays: -1 } },
        { $limit: 5 },
      ]),
    ]);

    return {
      userId,
      totalTracksPlayed: profile?.statistics?.totalTracksPlayed || 0,
      totalListeningMinutes: Math.round((profile?.statistics?.totalListeningTimeMs || 0) / 60000),
      currentStreak: profile?.streak?.currentStreak || 0,
      longestStreak: profile?.streak?.longestStreak || 0,
      topArtists: topArtists.map((a) => ({ name: a._id, plays: a.plays })),
      recentHistory: recentPlays.map((p) => ({
        title: p.metadata?.title || 'Unknown',
        author: p.metadata?.author || 'Unknown',
        playedAt: p.timestamp,
      })),
    };
  }
}

module.exports = UserAnalytics;
