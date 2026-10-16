const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema(
  {
    guildId: { type: String, required: true, index: true },
    userId: { type: String, required: true, index: true },
    action: { type: String, required: true },
    target: { type: String },
    metadata: { type: mongoose.Schema.Types.Mixed },
    timestamp: { type: Date, default: Date.now, expires: '30d' }, // TTL index: auto delete logs after 30 days
  },
  { timestamps: false }
);

module.exports = mongoose.model('AuditLog', auditLogSchema);
