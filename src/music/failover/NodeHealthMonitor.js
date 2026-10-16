const logger = require('../../logger/logger');

const NodeStatus = {
  HEALTHY: 'HEALTHY',
  DEGRADED: 'DEGRADED',
  UNHEALTHY: 'UNHEALTHY',
  DISCONNECTED: 'DISCONNECTED',
  DRAINING: 'DRAINING',
  RECOVERING: 'RECOVERING',
};

class NodeHealthMonitor {
  constructor() {
    this.nodeStats = new Map();
    this.checkInterval = null;
    this.intervalMs = 10000; // Check health every 10s
  }

  /**
   * Initialize state for a node
   */
  registerNode(node) {
    if (!node || !node.id) return;
    if (!this.nodeStats.has(node.id)) {
      this.nodeStats.set(node.id, {
        nodeId: node.id,
        host: node.options?.host || 'unknown',
        port: node.options?.port || 80,
        region: node.options?.region || 'AUTO',
        status: node.connected ? NodeStatus.HEALTHY : NodeStatus.DISCONNECTED,
        latency: 0,
        players: 0,
        playingPlayers: 0,
        cpu: { lavalink: 0, system: 0, cores: 1 },
        memory: { used: 0, free: 0, allocated: 0, reservable: 0 },
        uptime: 0,
        errorRate: 0,
        errorsWindow: [],
        lastHeartbeat: Date.now(),
        lastRestCheck: 0,
        connectionStability: 100, // 0-100%
        consecutiveFailures: 0,
      });
    }
  }

  /**
   * Start periodic health monitoring
   */
  start(lavalinkManager) {
    if (this.checkInterval) clearInterval(this.checkInterval);

    // Initial registration for all configured nodes
    if (lavalinkManager?.nodeManager?.nodes) {
      for (const node of lavalinkManager.nodeManager.nodes.values()) {
        this.registerNode(node);
      }
    }

    this.checkInterval = setInterval(() => {
      this.runHealthChecks(lavalinkManager).catch((err) => {
        logger.error('[NodeHealthMonitor] Health check cycle failed:', { error: err.message });
      });
    }, this.intervalMs);

    logger.info('[NodeHealthMonitor] Health monitoring service started.');
  }

  stop() {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
  }

  /**
   * Record node error to adjust error rate
   */
  recordNodeError(nodeId, error) {
    const stats = this.nodeStats.get(nodeId);
    if (!stats) return;

    const now = Date.now();
    stats.errorsWindow.push(now);
    stats.consecutiveFailures += 1;

    // Prune errors older than 60s
    stats.errorsWindow = stats.errorsWindow.filter((ts) => now - ts < 60000);
    stats.errorRate = stats.errorsWindow.length; // errors in last minute

    this.evaluateStatus(stats);
  }

  /**
   * Record successful node event
   */
  recordNodeSuccess(nodeId) {
    const stats = this.nodeStats.get(nodeId);
    if (!stats) return;
    stats.consecutiveFailures = 0;
    stats.lastHeartbeat = Date.now();
  }

  /**
   * Perform REST and status checks on all nodes
   */
  async runHealthChecks(lavalinkManager) {
    if (!lavalinkManager?.nodeManager?.nodes) return;

    for (const node of lavalinkManager.nodeManager.nodes.values()) {
      this.registerNode(node);
      const stats = this.nodeStats.get(node.id);
      if (!stats) continue;

      if (!node.connected) {
        stats.status = NodeStatus.DISCONNECTED;
        stats.connectionStability = Math.max(0, stats.connectionStability - 15);
        continue;
      }

      // Check stats from node object
      if (node.stats) {
        stats.players = node.stats.players || 0;
        stats.playingPlayers = node.stats.playingPlayers || 0;
        stats.uptime = node.stats.uptime || 0;
        stats.cpu = {
          lavalink: Math.round((node.stats.cpu?.lavalinkLoad || 0) * 100),
          system: Math.round((node.stats.cpu?.systemLoad || 0) * 100),
          cores: node.stats.cpu?.cores || 1,
        };
        stats.memory = {
          used: Math.round((node.stats.memory?.used || 0) / 1024 / 1024),
          free: Math.round((node.stats.memory?.free || 0) / 1024 / 1024),
          allocated: Math.round((node.stats.memory?.allocated || 0) / 1024 / 1024),
        };
      }

      // REST Latency test using request (e.g. /version or /v4/info)
      const startPing = Date.now();
      try {
        if (typeof node.fetchVersion === 'function') {
          await Promise.race([
            node.fetchVersion(),
            new Promise((_, reject) => setTimeout(() => reject(new Error('REST ping timeout')), 4000)),
          ]);
        }
        stats.latency = Date.now() - startPing;
        stats.lastRestCheck = Date.now();
        stats.consecutiveFailures = 0;
        stats.connectionStability = Math.min(100, stats.connectionStability + 10);
      } catch (err) {
        // If node is connected via WebSocket, treat it as healthy regardless of REST endpoint response
        stats.latency = node.ping || 100;
        if (node.connected) {
          stats.consecutiveFailures = 0;
          stats.connectionStability = Math.max(50, stats.connectionStability);
        } else {
          stats.consecutiveFailures += 1;
          stats.connectionStability = Math.max(0, stats.connectionStability - 20);
        }
        logger.debug(`[NodeHealthMonitor] REST check note for node ${node.id}: ${err.message}`);
      }

      // Prune error rate
      const now = Date.now();
      stats.errorsWindow = stats.errorsWindow.filter((ts) => now - ts < 60000);
      stats.errorRate = stats.errorsWindow.length;

      this.evaluateStatus(stats);
    }
  }

  /**
   * Compute node health status
   */
  evaluateStatus(stats) {
    if (stats.status === NodeStatus.DRAINING) {
      return; // Maintain DRAINING status if manually set
    }

    if (stats.consecutiveFailures >= 3 || stats.connectionStability < 20) {
      stats.status = NodeStatus.UNHEALTHY;
    } else if (
      stats.cpu.system > 85 ||
      stats.cpu.lavalink > 75 ||
      stats.errorRate > 5 ||
      stats.latency > 1500 ||
      stats.connectionStability < 60
    ) {
      stats.status = NodeStatus.DEGRADED;
    } else {
      stats.status = NodeStatus.HEALTHY;
    }
  }

  /**
   * Set draining status on a node (e.g., prior to maintenance)
   */
  setDraining(nodeId, isDraining = true) {
    const stats = this.nodeStats.get(nodeId);
    if (stats) {
      stats.status = isDraining ? NodeStatus.DRAINING : NodeStatus.HEALTHY;
    }
  }

  /**
   * Check if a node is able to accept players
   */
  isNodeUsable(nodeId) {
    const stats = this.nodeStats.get(nodeId);
    if (!stats) return false;
    return (
      stats.status === NodeStatus.HEALTHY ||
      stats.status === NodeStatus.DEGRADED ||
      stats.status === NodeStatus.RECOVERING
    );
  }

  /**
   * Get all registered node statuses
   */
  getAllNodeStats() {
    return Array.from(this.nodeStats.values());
  }

  getNodeStats(nodeId) {
    return this.nodeStats.get(nodeId) || null;
  }
}

module.exports = {
  NodeHealthMonitor: new NodeHealthMonitor(),
  NodeStatus,
};
