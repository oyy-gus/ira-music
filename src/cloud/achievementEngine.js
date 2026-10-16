const MusicAchievement = require('../database/models/MusicAchievement');
const logger = require('../logger/logger');

const ACHIEVEMENTS_REGISTRY = [
  {
    id: 'first_track',
    title: 'First Melody',
    description: 'Played your very first track on the bot.',
    icon: '🎵',
    emojiKey: 'achievement_first_melody',
    condition: (stats) => (stats.totalTracksPlayed || 0) >= 1,
  },
  {
    id: 'tracks_100',
    title: 'Music Enthusiast',
    description: 'Played 100 tracks.',
    icon: '🎧',
    emojiKey: 'achievement_tracks_100',
    condition: (stats) => (stats.totalTracksPlayed || 0) >= 100,
  },
  {
    id: 'tracks_1000',
    title: 'Audiophile Master',
    description: 'Played 1,000 tracks.',
    icon: '👑',
    emojiKey: 'achievement_tracks_1000',
    condition: (stats) => (stats.totalTracksPlayed || 0) >= 1000,
  },
  {
    id: 'streak_7',
    title: 'Daily Rhythm (7 Days)',
    description: 'Maintained a 7-day listening streak.',
    icon: '🔥',
    emojiKey: 'achievement_streak_7',
    condition: (stats, streak) => (streak?.currentStreak || 0) >= 7,
  },
  {
    id: 'streak_30',
    title: 'Dedication Legend (30 Days)',
    description: 'Maintained a 30-day listening streak.',
    icon: '⚡',
    emojiKey: 'achievement_streak_30',
    condition: (stats, streak) => (streak?.currentStreak || 0) >= 30,
  },
];

class AchievementEngine {
  /**
   * Evaluate achievements for user based on current profile statistics
   * @param {string} userId
   * @param {Object} statistics
   * @param {Object} streak
   * @returns {Promise<Array>} List of newly unlocked achievements
   */
  static async evaluateAchievements(userId, statistics = {}, streak = {}) {
    const existing = await MusicAchievement.find({ userId }).lean();
    const existingIds = new Set(existing.map((a) => a.achievementId));

    const newlyUnlocked = [];

    for (const ach of ACHIEVEMENTS_REGISTRY) {
      if (!existingIds.has(ach.id) && ach.condition(statistics, streak)) {
        try {
          const doc = new MusicAchievement({
            userId,
            achievementId: ach.id,
            title: ach.title,
            description: ach.description,
            icon: ach.icon,
          });
          await doc.save();
          newlyUnlocked.push(doc);
          logger.info(`[Achievement] User ${userId} unlocked achievement: "${ach.title}"`);
        } catch (e) {
          // Ignore duplicate if race condition occurs
        }
      }
    }

    return newlyUnlocked;
  }

  /**
   * Get all unlocked achievements for a user
   */
  static async getUserAchievements(userId) {
    return MusicAchievement.find({ userId }).sort({ unlockedAt: -1 }).lean();
  }
}

module.exports = {
  AchievementEngine,
  ACHIEVEMENTS_REGISTRY,
};
