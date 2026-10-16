const { NodeHealthMonitor, NodeStatus } = require('./NodeHealthMonitor');
const { PlayerMigrationManager } = require('./PlayerMigrationManager');
const RecoveryMetrics = require('./RecoveryMetrics');
const logger = require('../../logger/logger');

class FailureDetector {
  constructor() {
    this.failoverInProgress = new Set(); // nodeIds currently executing failovers
  }

  /**
   * Handle node disconnect event
   * @param {Object} client - Discord Client
   * @param {Object} node - Lavalink Node
   * @param {Object} reason - Disconnect reason
   */
  async handleNodeDisconnect(client, node, reason) {
    if (!node || !node.id) return;
    const nodeId = node.id;

    logger.warn(`[FailureDetector] Node disconnect detected on ${nodeId}. Reason: ${reason?.reason || 'Unknown'}`);
    RecoveryMetrics.increment('node_disconnects_total');
    RecoveryMetrics.increment('lavalink_failovers_total');

    RecoveryMetrics.logEvent('NODE_DISCONNECTED', {
      oldNodeId: nodeId,
      reason: reason?.reason || 'DISCONNECTED',
    });

    // Mark node as DISCONNECTED in health monitor
    const stats = NodeHealthMonitor.getNodeStats(nodeId);
    if (stats) {
      stats.status = NodeStatus.DISCONNECTED;
      stats.connectionStability = Math.max(0, stats.connectionStability - 30);
    }

    if (this.failoverInProgress.has(nodeId)) {
      logger.info(`[FailureDetector] Failover already in progress for node ${nodeId}. Skipping duplicate trigger.`);
      return;
    }

    this.failoverInProgress.add(nodeId);

    try {
      if (!client.lavalink) return;

      // Find all active players currently assigned to the disconnected node
      const affectedPlayers = Array.from(client.lavalink.players.values()).filter(
        (player) => player.node?.id === nodeId || (player.playing && !player.node?.connected)
      );

      logger.info(`[FailureDetector] Found ${affectedPlayers.length} active players on disconnected node ${nodeId}. Initiating failover...`);

      for (const player of affectedPlayers) {
        try {
          await PlayerMigrationManager.migratePlayer(client, player, `Node ${nodeId} Disconnected`);
        } catch (migErr) {
          logger.error(`[FailureDetector] Failed player failover for guild ${player.guildId}:`, {
            error: migErr.message,
          });
        }
      }
    } finally {
      this.failoverInProgress.delete(nodeId);
    }
  }

  /**
   * Handle node error event
   */
  handleNodeError(client, node, error) {
    if (!node || !node.id) return;
    const nodeId = node.id;
    const errMessage = error?.message || String(error || '');

    if (errMessage.includes('is not valid JSON') || errMessage.includes('Proxy error') || errMessage.includes('Unexpected token')) {
      logger.warn(`[FailureDetector] Lavalink Node '${nodeId}' host returned invalid proxy response (non-JSON): ${errMessage}`);
    } else {
      logger.error(`[FailureDetector] Node error on ${nodeId}:`, { error: errMessage });
    }

    NodeHealthMonitor.recordNodeError(nodeId, error);

    const stats = NodeHealthMonitor.getNodeStats(nodeId);
    if (stats && stats.status === NodeStatus.UNHEALTHY) {
      logger.warn(`[FailureDetector] Node ${nodeId} has degraded to UNHEALTHY status. Proactively failing over active players...`);
      this.handleNodeDisconnect(client, node, { reason: 'Degraded to UNHEALTHY' }).catch(() => {});
    }
  }

  /**
   * Handle node reconnecting event
   */
  handleNodeReconnecting(node) {
    if (!node || !node.id) return;
    logger.info(`[FailureDetector] Node ${node.id} is attempting reconnection...`);
    const stats = NodeHealthMonitor.getNodeStats(node.id);
    if (stats) {
      stats.status = NodeStatus.RECOVERING;
    }
  }

  /**
   * Handle node connected event
   */
  handleNodeConnect(node) {
    if (!node || !node.id) return;
    logger.info(`[FailureDetector] Node ${node.id} connected successfully.`);
    RecoveryMetrics.increment('node_reconnects_total');

    // Ensure node is registered in health monitor before marking it healthy
    NodeHealthMonitor.registerNode(node);
    NodeHealthMonitor.recordNodeSuccess(node.id);

    const stats = NodeHealthMonitor.getNodeStats(node.id);
    if (stats) {
      stats.status = NodeStatus.HEALTHY;
      stats.connectionStability = 100;
      stats.consecutiveFailures = 0;
    }
  }
}

module.exports = new FailureDetector();
