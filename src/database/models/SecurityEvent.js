const mongoose = require('mongoose');

const securityEventSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true, index: true },
    guildId: { type: String, required: true, index: true },
    eventType: {
      type: String,
      required: true,
      enum: [
        'COMMAND_SPAM',
        'REPEATED_FAILED_COMMAND',
        'EXCESSIVE_SEARCH',
        'QUEUE_ABUSE',
        'PLAYLIST_ABUSE',
        'PERMISSION_DENIED_BURST',
        'SUSPICIOUS_ACTIVITY',
      ],
      index: true,
    },
    command: { type: String },
    timestamp: { type: Date, default: Date.now, index: true },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
    severity: { type: String, enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'], default: 'LOW' },
    status: { type: String, enum: ['DETECTED', 'ALERTED', 'ESCALATED', 'RESOLVED'], default: 'DETECTED' },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

securityEventSchema.index({ userId: 1, guildId: 1, timestamp: -1 });

module.exports = mongoose.model('SecurityEvent', securityEventSchema);
