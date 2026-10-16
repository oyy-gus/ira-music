const mongoose = require('mongoose');

const musicAchievementSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true, index: true },
    achievementId: { type: String, required: true, index: true },
    title: { type: String, required: true },
    description: { type: String },
    icon: { type: String, default: '🏆' },
    category: { type: String, default: 'milestone' },
    unlockedAt: { type: Date, default: Date.now },
    progress: { type: Number, default: 100 },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

musicAchievementSchema.index({ userId: 1, achievementId: 1 }, { unique: true });

module.exports = mongoose.model('MusicAchievement', musicAchievementSchema);
