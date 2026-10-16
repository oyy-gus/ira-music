class TestReporter {
  /**
   * Format simulation test report to text or markdown
   */
  static generateReport(testResult) {
    const summary = testResult.summary || {};
    const successRate =
      summary.totalPlayersTested > 0
        ? (((summary.recoveredPlayers || 0) / summary.totalPlayersTested) * 100).toFixed(1)
        : '100.0';

    return [
      `======================================================`,
      `  🧪 SIMULATION & FAILURE TEST REPORT: ${testResult.testId}`,
      `======================================================`,
      `• Scenario: ${testResult.scenario}`,
      `• Environment: ${testResult.environment}`,
      `• Status: ${testResult.status}`,
      `• Duration: ${testResult.durationMs || 0}ms`,
      `------------------------------------------------------`,
      `• Total Players Tested: ${summary.totalPlayersTested || 0}`,
      `• Successfully Recovered: ${summary.recoveredPlayers || 0} (${successRate}%)`,
      `• Failed Recoveries: ${summary.failedRecoveries || 0}`,
      `• Duplicate Players: ${summary.duplicatePlayers || 0}`,
      `• Queue Loss Count: ${summary.queueLossCount || 0}`,
      `• Position Loss Rate: ${summary.positionLossRate || 0}%`,
      `• Regression Detected: ${testResult.regressionDetected ? '⚠️ YES' : '✅ NO'}`,
      `------------------------------------------------------`,
      testResult.errors?.length > 0 ? `Errors:\n  - ${testResult.errors.join('\n  - ')}` : `No errors detected.`,
      `======================================================`,
    ].join('\n');
  }
}

module.exports = TestReporter;
