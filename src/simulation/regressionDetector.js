class RegressionDetector {
  constructor(thresholds = {}) {
    this.thresholds = {
      maxRecoveryDurationMs: thresholds.maxRecoveryDurationMs || 3000,
      maxAllowedQueueLoss: thresholds.maxAllowedQueueLoss || 0,
      maxPositionLossRate: thresholds.maxPositionLossRate || 5.0, // 5%
    };
  }

  /**
   * Compare a test run against thresholds or baseline
   * @param {Object} currentRunSummary
   * @param {Object} [baselineSummary]
   * @returns {{ hasRegression: boolean, reasons: string[] }}
   */
  checkRegression(currentRunSummary, baselineSummary = null) {
    const reasons = [];

    if (currentRunSummary.queueLossCount > this.thresholds.maxAllowedQueueLoss) {
      reasons.push(`Queue loss exceeded threshold (detected ${currentRunSummary.queueLossCount} lost queues).`);
    }

    if (currentRunSummary.averageRecoveryDurationMs > this.thresholds.maxRecoveryDurationMs) {
      reasons.push(
        `Recovery duration ${currentRunSummary.averageRecoveryDurationMs}ms exceeded threshold ${this.thresholds.maxRecoveryDurationMs}ms.`
      );
    }

    if (currentRunSummary.positionLossRate > this.thresholds.maxPositionLossRate) {
      reasons.push(
        `Position loss rate ${currentRunSummary.positionLossRate}% exceeded threshold ${this.thresholds.maxPositionLossRate}%.`
      );
    }

    if (baselineSummary) {
      const durationIncrease =
        currentRunSummary.averageRecoveryDurationMs - baselineSummary.averageRecoveryDurationMs;
      if (durationIncrease > 1000) {
        reasons.push(
          `Recovery time regressed by +${durationIncrease}ms compared to baseline.`
        );
      }
    }

    return {
      hasRegression: reasons.length > 0,
      reasons,
    };
  }
}

module.exports = new RegressionDetector();
