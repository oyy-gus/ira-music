const EnvironmentManager = require('./environmentManager');
const latencyInjector = require('./latencyInjector');
const logger = require('../logger/logger');

class FailureInjectionManager {
  constructor() {
    this.injectedFailures = [];
  }

  /**
   * Simulate a Lavalink Node Disconnection
   * @param {Object} lavalink - LavalinkManager instance
   * @param {string} nodeId - Target node ID
   */
  async simulateNodeDisconnect(lavalink, nodeId) {
    EnvironmentManager.assertSimulationAllowed();
    const node = lavalink?.nodeManager?.nodes?.get(nodeId);
    if (!node) {
      throw new Error(`Node ${nodeId} not found in cluster.`);
    }

    logger.warn(`[FailureInjection] Simulating disconnect on node ${nodeId}`);
    if (typeof node.destroy === 'function') {
      node.destroy();
    }
  }

  /**
   * Simulate a track resolution failure
   */
  simulateTrackResolutionFailure() {
    EnvironmentManager.assertSimulationAllowed();
    return new Error('Simulated track resolution failure');
  }

  /**
   * Simulate MongoDB Latency / Disconnect
   */
  async simulateMongoLatency(delayMs = 1000) {
    EnvironmentManager.assertSimulationAllowed();
    latencyInjector.setLatency('database', delayMs);
  }

  resetAll() {
    latencyInjector.clearAll();
    this.injectedFailures = [];
  }
}

module.exports = new FailureInjectionManager();
