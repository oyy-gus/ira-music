'use strict';

const mongoose = require('mongoose');

const atlantisMemberSchema = new mongoose.Schema(
  {
    guildId: { type: String, required: true, index: true },
    userId: { type: String, required: true, index: true },
    guildName: { type: String, default: '' },
    userTag: { type: String, default: '' },
    avatar: { type: String, default: null },
    nickname: { type: String, default: null },
    level: { type: Number, default: 1 }, // 1: Member, 2: Booster/Recruit, 3: Admin/Mod
    premium: { type: Date, default: null }, // Server booster date
    joinedServer: { type: Date, default: Date.now },
    owosPastWeek: { type: Number, default: 0, index: true },
    owosArchive: [
      {
        weekOf: { type: String },
        amountOfOwos: { type: Number, default: 0 },
        hitreq: { type: String, default: '❌' }, // '✔️' | '❌' | '⚠️'
        time: { type: String },
      },
    ],
  },
  { timestamps: true }
);

// Compound unique index per server + user
atlantisMemberSchema.index({ guildId: 1, userId: 1 }, { unique: true });
atlantisMemberSchema.index({ guildId: 1, owosPastWeek: -1 });

module.exports = mongoose.model('AtlantisMember', atlantisMemberSchema);
