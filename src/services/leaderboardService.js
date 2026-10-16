/**
 * Shared Leaderboard Service
 * Handles Global & Server rankings for users and servers.
 */

const userRepo = require('../database/repositories/userRepository');
const guildRepo = require('../database/repositories/guildRepository');

class LeaderboardService {
  /**
   * Fetch Global Top Users by listening time
   */
  static async getGlobalUserLeaderboard(limit = 10, excludeIds = []) {
    return userRepo.getGlobalTopUsers(limit, excludeIds);
  }

  /**
   * Fetch Global Top Servers by server listening time
   */
  static async getGlobalServerLeaderboard(limit = 10, client = null) {
    return guildRepo.getGlobalTopServers(limit, client);
  }

  /**
   * Fetch Server Top Users by listening time in a specific server
   */
  static async getServerUserLeaderboard(guildId, limit = 10, excludeIds = []) {
    return userRepo.getServerTopUsers(guildId, limit, excludeIds);
  }

  /**
   * Fetch user ranks for global and server
   */
  static async getUserRanks(userId, guildId = null) {
    const [globalRank, serverRank] = await Promise.all([
      userRepo.getUserGlobalRank(userId),
      guildId ? userRepo.getUserGuildRank(userId, guildId) : Promise.resolve('N/A'),
    ]);
    return { globalRank, serverRank };
  }
}

module.exports = LeaderboardService;
