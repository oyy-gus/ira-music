const mongoose = require('mongoose');

const userMusicProfileSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true, unique: true, index: true },
    username: { type: String },
    preferences: {
      defaultVolume: { type: Number, default: 100, min: 1, max: 150 },
      defaultAutoplay: { type: Boolean, default: false },
      defaultRepeat: { type: String, enum: ['off', 'track', 'queue'], default: 'off' },
      defaultShuffle: { type: Boolean, default: false },
      preferredSource: { type: String, default: 'soundcloud' },
      preferredAudioPreset: { type: String, default: 'flat' },
      preferredLanguage: { type: String, default: 'en' },
      timezone: { type: String, default: 'UTC' },
    },
    streak: {
      currentStreak: { type: Number, default: 0 },
      longestStreak: { type: Number, default: 0 },
      lastListeningDate: { type: String },
      lastActiveTimestamp: { type: Date },
    },
    privacySettings: {
      isProfilePublic: { type: Boolean, default: true },
      hideListeningHistory: { type: Boolean, default: false },
      hideStatistics: { type: Boolean, default: false },
    },
    statistics: {
      totalListeningTimeMs: { type: Number, default: 0 },
      totalTracksPlayed: { type: Number, default: 0 },
      totalUniqueArtists: { type: Number, default: 0 },
      mostActiveGuilds: [
        {
          guildId: String,
          playCount: { type: Number, default: 0 },
        },
      ],
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

module.exports = mongoose.model('UserMusicProfile', userMusicProfileSchema);
