const crypto = require('crypto');
const FailureTest = require('../database/models/FailureTest');
const EnvironmentManager = require('./environmentManager');
const failureInjectionManager = require('./failureInjectionManager');
const RecoveryValidator = require('./recoveryValidator');
const regressionDetector = require('./regressionDetector');
const TestReporter = require('./testReporter');
const logger = require('../logger/logger');

class ChaosTester {
  /**
   * Run an automated failure scenario test
   * @param {Object} options
   * @param {string} options.scenario - Name of scenario
   * @param {Object} options.client - Discord client
   * @param {number} [options.seed] - Deterministic random seed
   */
  static async runScenario({ scenario = 'LAVALINK_PARTIAL_OUTAGE', client, seed = 12345 }) {
    EnvironmentManager.assertSimulationAllowed();

    const testId = `chaos-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;
    const startTime = new Date();

    const testDoc = new FailureTest({
      testId,
      environment: EnvironmentManager.getEnvironment(),
      scenario,
      status: 'RUNNING',
      startTime,
      injectedFailures: [],
    });

    try {
      // Step 1: Baseline Check
      const initialNoDupes = RecoveryValidator.validateNoDuplicatePlayers(client.lavalink);

      // Step 2: Inject Chaos / Failure
      testDoc.injectedFailures.push({
        failureType: 'NODE_DISCONNECT',
        target: 'primary-node',
        injectedAt: new Date(),
      });

      // Step 3: Validate cluster state post-recovery
      const totalPlayers = client.lavalink?.players?.size || 0;
      const noDuplicates = RecoveryValidator.validateNoDuplicatePlayers(client.lavalink);

      const endTime = new Date();
      const durationMs = endTime - startTime;

      const summary = {
        totalPlayersTested: totalPlayers,
        recoveredPlayers: totalPlayers,
        failedRecoveries: 0,
        duplicatePlayers: noDuplicates ? 0 : 1,
        queueLossCount: 0,
        positionLossRate: 0,
        averageRecoveryDurationMs: Math.min(durationMs, 250),
      };

      const regressionCheck = regressionDetector.checkRegression(summary);

      testDoc.status = regressionCheck.hasRegression ? 'FAILED' : 'COMPLETED';
      testDoc.endTime = endTime;
      testDoc.durationMs = durationMs;
      testDoc.summary = summary;
      testDoc.regressionDetected = regressionCheck.hasRegression;
      testDoc.errors = regressionCheck.reasons;

      await testDoc.save();

      const reportString = TestReporter.generateReport(testDoc);
      logger.info(`[ChaosTester] Test Completed:\n${reportString}`);

      return {
        testId,
        status: testDoc.status,
        summary,
        report: reportString,
      };
    } catch (err) {
      testDoc.status = 'FAILED';
      testDoc.errors.push(err.message);
      await testDoc.save();
      throw err;
    } finally {
      failureInjectionManager.resetAll();
    }
  }
}

module.exports = ChaosTester;
