const UserMusicProfile = require('../database/models/UserMusicProfile');

class ListeningStreak {
  /**
   * Helper to format YYYY-MM-DD in a given timezone
   */
  static getDateKeyInTimezone(date = new Date(), timezone = 'UTC') {
    try {
      const formatter = new Intl.DateTimeFormat('en-CA', {
        timeZone: timezone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      });
      return formatter.format(date); // outputs YYYY-MM-DD
    } catch (e) {
      return date.toISOString().split('T')[0];
    }
  }

  /**
   * Record listening activity and increment/maintain streak
   * @param {string} userId
   * @param {string} [timezone='UTC']
   */
  static async recordActivity(userId, timezone = 'UTC') {
    let profile = await UserMusicProfile.findOne({ userId });
    if (!profile) {
      profile = new UserMusicProfile({ userId, streak: { currentStreak: 0, longestStreak: 0 } });
    }

    const userTz = profile.preferences?.timezone || timezone || 'UTC';
    const now = new Date();
    const todayKey = this.getDateKeyInTimezone(now, userTz);
    const lastDate = profile.streak?.lastListeningDate;

    // Same day activity: maintain streak
    if (lastDate === todayKey) {
      profile.streak.lastActiveTimestamp = now;
      await profile.save();
      return profile.streak;
    }

    // Yesterday calculation in user timezone
    const yesterday = new Date(now.getTime() - 24 * 3600 * 1000);
    const yesterdayKey = this.getDateKeyInTimezone(yesterday, userTz);

    if (lastDate === yesterdayKey) {
      // Consecutive day: increment streak
      profile.streak.currentStreak = (profile.streak.currentStreak || 0) + 1;
    } else {
      // Missed a day or first time: reset streak to 1
      profile.streak.currentStreak = 1;
    }

    if (profile.streak.currentStreak > (profile.streak.longestStreak || 0)) {
      profile.streak.longestStreak = profile.streak.currentStreak;
    }

    profile.streak.lastListeningDate = todayKey;
    profile.streak.lastActiveTimestamp = now;
    await profile.save();

    return profile.streak;
  }
}

module.exports = ListeningStreak;
