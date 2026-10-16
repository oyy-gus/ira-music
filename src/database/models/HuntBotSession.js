'use strict';

const mongoose = require('mongoose');

const huntBotSessionSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true, unique: true, index: true },
    channelId: { type: String, required: true },
    guildId: { type: String, default: null },
    timeoutAt: { type: Number, required: true, index: true },
    durationString: { type: String, default: '' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('HuntBotSession', huntBotSessionSchema);
