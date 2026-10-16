const Playlist = require('../models/Playlist');
const logger = require('../../logger/logger');

const createPlaylist = async (ownerId, name, description = '', visibility = 'private') => {
  try {
    return await Playlist.create({ ownerId, name, description, visibility, tracks: [] });
  } catch (error) {
    if (error.code === 11000) {
      throw new Error(`A playlist named "${name}" already exists.`);
    }
    logger.error(`[PlaylistRepo] Error creating playlist ${name} for ${ownerId}:`, { error: error.message });
    throw error;
  }
};

const getUserPlaylists = async (ownerId) => {
  try {
    return await Playlist.find({ ownerId }).lean();
  } catch (error) {
    logger.error(`[PlaylistRepo] Error fetching playlists for user ${ownerId}:`, { error: error.message });
    return [];
  }
};

const getPlaylistByName = async (ownerId, name) => {
  try {
    return await Playlist.findOne({ ownerId, name: new RegExp(`^${name}$`, 'i') }).lean();
  } catch (error) {
    logger.error(`[PlaylistRepo] Error fetching playlist ${name} for ${ownerId}:`, { error: error.message });
    return null;
  }
};

const addTrackToPlaylist = async (playlistId, trackData) => {
  try {
    return await Playlist.findByIdAndUpdate(
      playlistId,
      { $push: { tracks: trackData } },
      { new: true }
    ).lean();
  } catch (error) {
    logger.error(`[PlaylistRepo] Error adding track to playlist ${playlistId}:`, { error: error.message });
    throw error;
  }
};

const removeTrackFromPlaylist = async (playlistId, positionIndex) => {
  try {
    const playlist = await Playlist.findById(playlistId);
    if (!playlist || positionIndex < 0 || positionIndex >= playlist.tracks.length) {
      throw new Error('Invalid track position.');
    }
    playlist.tracks.splice(positionIndex, 1);
    await playlist.save();
    return playlist.toObject();
  } catch (error) {
    logger.error(`[PlaylistRepo] Error removing track at index ${positionIndex} from playlist ${playlistId}:`, { error: error.message });
    throw error;
  }
};

const deletePlaylist = async (ownerId, name) => {
  try {
    const result = await Playlist.deleteOne({ ownerId, name: new RegExp(`^${name}$`, 'i') });
    return result.deletedCount > 0;
  } catch (error) {
    logger.error(`[PlaylistRepo] Error deleting playlist ${name} for ${ownerId}:`, { error: error.message });
    throw error;
  }
};

module.exports = {
  createPlaylist,
  getUserPlaylists,
  getPlaylistByName,
  addTrackToPlaylist,
  removeTrackFromPlaylist,
  deletePlaylist,
};
