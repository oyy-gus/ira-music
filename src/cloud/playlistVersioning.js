const Playlist = require('../database/models/Playlist');
const CustomError = require('../utils/CustomError');

class PlaylistVersioning {
  /**
   * Update playlist with optimistic concurrency control
   * @param {string} playlistId
   * @param {number} expectedVersion
   * @param {Object} updateData
   * @param {string} actorId
   * @returns {Promise<Object>}
   */
  static async updatePlaylistWithVersion(playlistId, expectedVersion, updateData, actorId) {
    const playlist = await Playlist.findById(playlistId);
    if (!playlist) {
      throw new CustomError('PLAYLIST_NOT_FOUND', 'Playlist not found.');
    }

    // Version conflict detection
    const currentVersion = playlist.version || 1;
    if (expectedVersion !== undefined && expectedVersion !== currentVersion) {
      throw new CustomError(
        'VERSION_CONFLICT',
        `Concurrent modification conflict: playlist is at version ${currentVersion}, but update was submitted for version ${expectedVersion}.`,
        'Concurrent modification conflict detected'
      );
    }

    // Increment version
    const updated = await Playlist.findOneAndUpdate(
      { _id: playlistId, version: currentVersion },
      {
        $set: { ...updateData, updatedAt: new Date() },
        $inc: { version: 1 },
      },
      { new: true }
    );

    if (!updated) {
      throw new CustomError(
        'VERSION_CONFLICT',
        'Playlist was modified concurrently by another process. Please refresh and try again.'
      );
    }

    return updated;
  }
}

module.exports = PlaylistVersioning;
