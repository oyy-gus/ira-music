'use strict';

const mongoose = require('mongoose');

const atlantisUserSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true, unique: true, index: true },
    reminders: {
      hunt: { type: Boolean, default: true },
      battle: { type: Boolean, default: false },
      owo: { type: Boolean, default: false },
      praycurse: { type: Boolean, default: true },
      huntbot: { type: Boolean, default: true },
    },
    stats: {
      owoCount: { type: Number, default: 0 },
      huntCount: { type: Number, default: 0 },
      battleCount: { type: Number, default: 0 },
      praycurseCount: { type: Number, default: 0 },
      completedHuntbots: { type: Number, default: 0 },
      totalHuntbotTime: { type: Number, default: 0 },
      dailyOwoCount: { type: Number, default: 0 },
      dailyHuntCount: { type: Number, default: 0 },
      dailyBattleCount: { type: Number, default: 0 },
      dailyPraycurseCount: { type: Number, default: 0 },
      guilds: { type: Map, of: Object, default: () => new Map() },
    },
    customs: {
      type: [
        {
          id: { type: Number, required: true },
          unlocked: { type: Boolean, default: true },
          trigger: { type: String, default: '' }, // 'b' | 'a' | 'e'
          triggerText: { type: String, default: '' },
          time: { type: Number, default: 0 },
          displayTime: { type: String, default: '' },
        },
      ],
      default: [
        { id: 1, unlocked: true, trigger: '', triggerText: '', time: 0, displayTime: '' },
        { id: 2, unlocked: true, trigger: '', triggerText: '', time: 0, displayTime: '' },
        { id: 3, unlocked: true, trigger: '', triggerText: '', time: 0, displayTime: '' },
      ],
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('AtlantisUser', atlantisUserSchema);
