const RecoveryMetrics = require('../music/failover/RecoveryMetrics');

class RealtimeAnalytics {
  /**
   * Get real-time snapshot of the running bot platform
   * @param {Object} client - Discord client
   */
  static getSnapshot(client) {
    const players = client.lavalink?.players || new Map();
    const activePlayers = Array.from(players.values());

    const playingPlayers = activePlayers.filter((p) => p.playing && !p.paused);
    const pausedPlayers = activePlayers.filter((p) => p.paused);

    const nodes = client.lavalink?.nodeManager?.nodes || new Map();
    const connectedNodes = Array.from(nodes.values()).filter((n) => n.connected);

    const failoverStats = RecoveryMetrics.getMetricsSummary();

    return {
      timestamp: new Date(),
      guildsCount: client.guilds?.cache?.size || 0,
      activeSessions: activePlayers.length,
      playingSessions: playingPlayers.length,
      pausedSessions: pausedPlayers.length,
      connectedNodesCount: connectedNodes.length,
      totalNodesCount: nodes.size,
      failoverStats,
      uptimeSeconds: Math.floor(process.uptime()),
    };
  }
}

module.exports = RealtimeAnalytics;
