const EnvironmentManager = require('./environmentManager');

class LatencyInjector {
  constructor() {
    this.activeLatencies = new Map();
  }

  /**
   * Set latency delay for target module
   * @param {'database'|'lavalink'|'api'|'network'} target
   * @param {number} delayMs - e.g. 100, 500, 1000, 5000, 10000
   */
  setLatency(target, delayMs) {
    EnvironmentManager.assertSimulationAllowed();
    if (delayMs <= 0) {
      this.activeLatencies.delete(target);
    } else {
      this.activeLatencies.set(target, delayMs);
    }
  }

  /**
   * Injects latency if active for the target
   * @param {'database'|'lavalink'|'api'|'network'} target
   */
  async inject(target) {
    if (!EnvironmentManager.isSimulationAllowed()) return;
    const delay = this.activeLatencies.get(target);
    if (delay && delay > 0) {
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  clearAll() {
    this.activeLatencies.clear();
  }
}

module.exports = new LatencyInjector();
