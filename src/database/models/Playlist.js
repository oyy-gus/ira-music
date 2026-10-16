const mongoose = require('mongoose');

const playlistTrackSchema = new mongoose.Schema({
  title: { type: String, required: true },
  author: { type: String },
  uri: { type: String, required: true },
  identifier: { type: String },
  duration: { type: Number },
  sourceName: { type: String },
  addedBy: { type: String },
  addedAt: { type: Date, default: Date.now },
});

const playlistSchema = new mongoose.Schema(
  {
    ownerId: { type: String, required: true, index: true },
    guildId: { type: String, index: true },
    name: { type: String, required: true, trim: true },
    description: { type: String, default: '' },
    visibility: { type: String, enum: ['public', 'private'], default: 'private' },
    tracks: [playlistTrackSchema],
    collaborators: [{ type: String }],
  },
  { timestamps: true }
);

playlistSchema.index({ ownerId: 1, name: 1 }, { unique: true });

module.exports = mongoose.model('Playlist', playlistSchema);
