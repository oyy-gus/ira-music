const mongoose = require('mongoose');

const failureTestSchema = new mongoose.Schema(
  {
    testId: { type: String, required: true, unique: true, index: true },
    environment: {
      type: String,
      required: true,
      enum: ['development', 'test', 'staging', 'canary', 'disaster-recovery'],
      index: true,
    },
    scenario: { type: String, required: true },
    status: {
      type: String,
      enum: ['PENDING', 'RUNNING', 'COMPLETED', 'FAILED', 'ABORTED'],
      default: 'PENDING',
      index: true,
    },
    injectedFailures: [
      {
        failureType: String,
        target: String,
        injectedAt: Date,
        resolvedAt: Date,
        durationMs: Number,
      },
    ],
    startTime: { type: Date },
    endTime: { type: Date },
    durationMs: { type: Number },
    summary: {
      totalPlayersTested: { type: Number, default: 0 },
      recoveredPlayers: { type: Number, default: 0 },
      failedRecoveries: { type: Number, default: 0 },
      duplicatePlayers: { type: Number, default: 0 },
      queueLossCount: { type: Number, default: 0 },
      positionLossRate: { type: Number, default: 0 },
      averageRecoveryDurationMs: { type: Number, default: 0 },
    },
    regressionDetected: { type: Boolean, default: false },
    errors: [{ type: String }],
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

module.exports = mongoose.model('FailureTest', failureTestSchema);
