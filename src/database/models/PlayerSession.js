const mongoose = require('mongoose');

const PlayerSessionSchema = new mongoose.Schema(
  {
    guildId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    voiceChannelId: {
      type: String,
      required: true,
    },
    textChannelId: {
      type: String,
      default: null,
    },
    nodeId: {
      type: String,
      default: null,
    },
    currentTrack: {
      encoded: { type: String, default: null },
      identifier: { type: String, default: null },
      title: { type: String, default: null },
      author: { type: String, default: null },
      source: { type: String, default: null },
      uri: { type: String, default: null },
      duration: { type: Number, default: 0 },
      artworkUrl: { type: String, default: null },
      isStream: { type: Boolean, default: false },
      isSeekable: { type: Boolean, default: true },
      userData: {
        requesterId: { type: String, default: null },
        requesterTag: { type: String, default: null },
      },
    },
    position: {
      type: Number,
      default: 0,
    },
    positionUpdatedAt: {
      type: Date,
      default: Date.now,
    },
    queue: [
      {
        encoded: { type: String, default: null },
        identifier: { type: String, default: null },
        title: { type: String, default: null },
        author: { type: String, default: null },
        source: { type: String, default: null },
        uri: { type: String, default: null },
        duration: { type: Number, default: 0 },
        artworkUrl: { type: String, default: null },
        isStream: { type: Boolean, default: false },
        isSeekable: { type: Boolean, default: true },
        userData: {
          requesterId: { type: String, default: null },
          requesterTag: { type: String, default: null },
        },
      },
    ],
    previousTracks: [
      {
        encoded: { type: String, default: null },
        identifier: { type: String, default: null },
        title: { type: String, default: null },
        author: { type: String, default: null },
        source: { type: String, default: null },
        uri: { type: String, default: null },
        duration: { type: Number, default: 0 },
        artworkUrl: { type: String, default: null },
        userData: {
          requesterId: { type: String, default: null },
          requesterTag: { type: String, default: null },
        },
      },
    ],
    currentIndex: {
      type: Number,
      default: 0,
    },
    volume: {
      type: Number,
      default: 100,
    },
    filters: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    repeatMode: {
      type: String,
      enum: ['off', 'track', 'queue'],
      default: 'off',
    },
    shuffle: {
      type: Boolean,
      default: false,
    },
    autoplay: {
      type: Boolean,
      default: false,
    },
    nowPlayingMessageId: {
      type: String,
      default: null,
    },
    status: {
      type: String,
      enum: ['NORMAL', 'PLAYING', 'PAUSED', 'MIGRATING', 'RECOVERING', 'SAVED_FOR_RESTART', 'STALE', 'IDLE'],
      default: 'NORMAL',
      index: true,
    },
    recoveryAttempts: {
      type: Number,
      default: 0,
    },
    lastHeartbeat: {
      type: Date,
      default: Date.now,
      index: true,
    },
    lastError: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Compound index for quick active sessions querying
PlayerSessionSchema.index({ status: 1, lastHeartbeat: -1 });

// TTL index to automatically purge inactive sessions after 24 hours (86400 seconds)
PlayerSessionSchema.index({ updatedAt: 1 }, { expireAfterSeconds: 86400 });

module.exports = mongoose.model('PlayerSession', PlayerSessionSchema);

