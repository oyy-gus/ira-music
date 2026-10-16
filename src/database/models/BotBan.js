'use strict';

const mongoose = require('mongoose');

const botBanSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true, unique: true, index: true },
    username: { type: String, default: '' },
    reason: { type: String, default: 'No reason provided' },
    bannedBy: { type: String, default: 'System' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('BotBan', botBanSchema);
