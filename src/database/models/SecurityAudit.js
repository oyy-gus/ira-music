const mongoose = require('mongoose');

const securityAuditSchema = new mongoose.Schema(
  {
    eventId: { type: String, required: true, unique: true, index: true },
    timestamp: { type: Date, default: Date.now, index: true },
    actorId: { type: String, required: true, index: true },
    guildId: { type: String, index: true },
    action: { type: String, required: true, index: true },
    target: { type: String },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
    ip: { type: String },
    result: { type: String, enum: ['SUCCESS', 'DENIED', 'FAILED', 'ERROR'], default: 'SUCCESS' },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

securityAuditSchema.index({ guildId: 1, timestamp: -1 });
securityAuditSchema.index({ actorId: 1, timestamp: -1 });

module.exports = mongoose.model('SecurityAudit', securityAuditSchema);
