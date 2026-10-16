const mongoose = require('mongoose');

const analyticsEventSchema = new mongoose.Schema(
  {
    eventId: { type: String, required: true, unique: true, index: true },
    guildId: { type: String, required: true, index: true },
    userId: { type: String, index: true },
    playerId: { type: String },
    trackId: { type: String, index: true },
    eventType: {
      type: String,
      required: true,
      enum: [
        'TRACK_START',
        'TRACK_END',
        'TRACK_SKIP',
        'TRACK_ERROR',
        'TRACK_PAUSE',
        'TRACK_RESUME',
        'QUEUE_ADD',
        'QUEUE_REMOVE',
        'PLAYER_JOIN',
        'PLAYER_LEAVE',
        'PLAYER_MIGRATE',
        'PLAYER_RECOVER',
      ],
      index: true,
    },
    timestamp: { type: Date, default: Date.now, index: true },
    metadata: {
      title: { type: String },
      author: { type: String },
      source: { type: String },
      duration: { type: Number },
      playbackPosition: { type: Number },
      completionPercentage: { type: Number },
      reason: { type: String },
      nodeId: { type: String },
      custom: { type: mongoose.Schema.Types.Mixed },
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

// Compound indexes for rapid analytics lookups
analyticsEventSchema.index({ guildId: 1, eventType: 1, timestamp: -1 });
analyticsEventSchema.index({ userId: 1, eventType: 1, timestamp: -1 });
analyticsEventSchema.index({ trackId: 1, eventType: 1 });

// TTL retention index (default 90 days: 90 * 24 * 3600 = 7776000 seconds)
analyticsEventSchema.index({ createdAt: 1 }, { expireAfterSeconds: 7776000 });

module.exports = mongoose.model('AnalyticsEvent', analyticsEventSchema);
