const config = require('../config');

class EnvironmentManager {
  /**
   * Get current environment name
   * @returns {string}
   */
  static getEnvironment() {
    return process.env.NODE_ENV || config.app.env || 'development';
  }

  /**
   * Verify whether failure injection and simulation tests are allowed
   * MUST return false in 'production' to protect live workloads
   */
  static isSimulationAllowed() {
    const env = this.getEnvironment().toLowerCase();
    const safeSimulationEnvs = ['development', 'test', 'staging', 'canary', 'disaster-recovery'];
    return safeSimulationEnvs.includes(env) && env !== 'production';
  }

  /**
   * Assert simulation is allowed, throws Error if attempted on production
   */
  static assertSimulationAllowed() {
    if (!this.isSimulationAllowed()) {
      throw new Error(
        `[EnvironmentManager] Failure injection and simulation are strictly FORBIDDEN in production environment.`
      );
    }
  }
}

module.exports = EnvironmentManager;
