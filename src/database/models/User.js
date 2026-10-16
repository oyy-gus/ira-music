const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
  {
    discordId: { type: String, required: true, unique: true, index: true },
    aboutMe: { type: String, default: 'Music Enthusiast 🎧 | Enjoying live streams & beats' },
    xp: { type: Number, default: 0, index: true },
    level: { type: Number, default: 1, index: true },
    badges: [{ type: String }],
    unlockedCosmetics: [{ type: String }],
    equippedCosmetics: {
      frame: { type: String, default: 'frame_basic' },
      background: { type: String, default: 'bg_dark' },
      glow: { type: String, default: 'glow_blue' },
      decoration: { type: String, default: 'deco_notes' },
      avatarEffect: { type: String, default: null },
      nameEffect: { type: String, default: null },
      levelEmblem: { type: String, default: 'emblem_listener' },
      visualizer: { type: String, default: null },
      title: { type: String, default: 'title_first' },
    },
    guildListeningTime: [
      {
        guildId: { type: String, required: true },
        guildName: { type: String, default: '' },
        listeningSeconds: { type: Number, default: 0 },
      },
    ],
    seasonHistory: [
      {
        seasonId: { type: String },
        rank: { type: Number },
        listeningSeconds: { type: Number, default: 0 },
      },
    ],
    topTracks: [
      {
        title: { type: String },
        author: { type: String },
        uri: { type: String },
        playCount: { type: Number, default: 1 },
      },
    ],
    topGuilds: [
      {
        guildId: { type: String },
        guildName: { type: String },
        playCount: { type: Number, default: 1 },
      },
    ],
    topCompanions: [
      {
        userId: { type: String },
        username: { type: String },
        listenCount: { type: Number, default: 1 },
      },
    ],
    statistics: {
      songsPlayed: { type: Number, default: 0 },
      timeListenedSeconds: { type: Number, default: 0, index: true },
    },
    isPrivate: { type: Boolean, default: false },
  },
  { timestamps: true }
);

module.exports = mongoose.model('User', userSchema);
