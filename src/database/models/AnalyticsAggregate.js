const mongoose = require('mongoose');

const analyticsAggregateSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      required: true,
      enum: ['guild', 'user', 'track', 'global'],
      index: true,
    },
    targetId: { type: String, required: true, index: true },
    period: {
      type: String,
      required: true,
      enum: ['hourly', 'daily', 'monthly', 'all-time'],
      index: true,
    },
    periodKey: { type: String, required: true, index: true }, // e.g. "2026-09-29", "2026-09", "all"
    stats: {
      totalPlays: { type: Number, default: 0 },
      totalListeningTimeMs: { type: Number, default: 0 },
      totalSkips: { type: Number, default: 0 },
      totalErrors: { type: Number, default: 0 },
      totalRecoveries: { type: Number, default: 0 },
      totalMigrations: { type: Number, default: 0 },
      uniqueUsers: [{ type: String }],
      topTracks: [
        {
          identifier: String,
          title: String,
          author: String,
          playCount: { type: Number, default: 0 },
        },
      ],
      topArtists: [
        {
          name: String,
          playCount: { type: Number, default: 0 },
        },
      ],
      topSources: [
        {
          source: String,
          playCount: { type: Number, default: 0 },
        },
      ],
    },
    lastAggregatedAt: { type: Date, default: Date.now },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

analyticsAggregateSchema.index({ type: 1, targetId: 1, period: 1, periodKey: 1 }, { unique: true });

module.exports = mongoose.model('AnalyticsAggregate', analyticsAggregateSchema);
