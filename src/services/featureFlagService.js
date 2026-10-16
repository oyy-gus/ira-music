const logger = require('../logger/logger');

class FeatureFlagService {
  constructor() {
    this.flags = new Map([
      ['smartQueue', true],
      ['musicIntelligence', true],
      ['recommendationEngine', true],
      ['advancedAutoplay', true],
      ['playerMigration', true],
      ['nodeCircuitBreaker', true],
      ['musicAnalytics', true],
      ['advancedFilters', true],
    ]);

    this.maintenanceMode = {
      global: false,
      message: 'The bot is currently undergoing scheduled maintenance. Please try again later.',
    };
  }

  isEnabled(flagName) {
    if (this.flags.has(flagName)) {
      return this.flags.get(flagName);
    }
    return true; // Default enabled
  }

  setFlag(flagName, enabled) {
    this.flags.set(flagName, Boolean(enabled));
    logger.info(`[FeatureFlag] Flag "${flagName}" set to ${enabled}`);
  }

  isMaintenance() {
    return this.maintenanceMode.global;
  }

  setMaintenance(status, message) {
    this.maintenanceMode.global = Boolean(status);
    if (message) this.maintenanceMode.message = message;
    logger.info(`[Maintenance] Global maintenance mode set to ${status}`);
  }
}

module.exports = new FeatureFlagService();
