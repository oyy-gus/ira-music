const Playlist = require('../database/models/Playlist');

class DataOwnership {
  /**
   * Check if user has permission to view a playlist
   * @param {Object} playlist
   * @param {string} userId
   * @param {string} [guildId]
   */
  static canView(playlist, userId, guildId = null) {
    if (!playlist) return false;
    if (playlist.userId === userId) return true;
    if (playlist.visibility === 'public') return true;
    if (playlist.collaborators?.includes(userId)) return true;
    if (guildId && playlist.guildId === guildId && playlist.visibility === 'guild') return true;
    return false;
  }

  /**
   * Check if user has permission to edit/mutate a playlist
   * @param {Object} playlist
   * @param {string} userId
   */
  static canEdit(playlist, userId) {
    if (!playlist) return false;
    if (playlist.userId === userId) return true;
    if (playlist.collaborators?.includes(userId)) return true;
    return false;
  }

  /**
   * Check if user is the absolute owner
   */
  static isOwner(playlist, userId) {
    return playlist && playlist.userId === userId;
  }
}

module.exports = DataOwnership;
