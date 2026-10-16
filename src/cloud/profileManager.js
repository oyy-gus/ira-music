const UserMusicProfile = require('../database/models/UserMusicProfile');
const { AchievementEngine } = require('./achievementEngine');

class ProfileManager {
  /**
   * Get or create UserMusicProfile
   */
  static async getOrCreateProfile(userId, username = '') {
    let profile = await UserMusicProfile.findOne({ userId });
    if (!profile) {
      profile = new UserMusicProfile({
        userId,
        username,
      });
      await profile.save();
    }
    return profile;
  }

  /**
   * Get unified cross-guild profile with privacy awareness
   * @param {string} targetUserId
   * @param {string} viewerUserId
   */
  static async getProfile(targetUserId, viewerUserId = null) {
    const profile = await this.getOrCreateProfile(targetUserId);
    const achievements = await AchievementEngine.getUserAchievements(targetUserId);

    const isOwner = viewerUserId === targetUserId;
    const privacy = profile.privacySettings || {};

    if (!isOwner && !privacy.isProfilePublic) {
      return {
        userId: targetUserId,
        isPrivate: true,
        message: 'This user profile is private.',
      };
    }

    return {
      userId: targetUserId,
      username: profile.username,
      streak: profile.streak,
      statistics: !isOwner && privacy.hideStatistics ? null : profile.statistics,
      achievements,
      preferences: isOwner ? profile.preferences : null,
      privacySettings: isOwner ? profile.privacySettings : null,
    };
  }

  /**
   * Update user privacy settings
   */
  static async updatePrivacy(userId, settings = {}) {
    return UserMusicProfile.findOneAndUpdate(
      { userId },
      { $set: { privacySettings: settings } },
      { new: true, upsert: true }
    );
  }

  /**
   * Update user preferences
   */
  static async updatePreferences(userId, preferences = {}) {
    return UserMusicProfile.findOneAndUpdate(
      { userId },
      { $set: { preferences } },
      { new: true, upsert: true }
    );
  }
}

module.exports = ProfileManager;
