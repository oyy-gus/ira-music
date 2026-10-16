const logger = require('../../logger/logger');

class RecoveryMetrics {
  constructor() {
    this.metrics = {
      lavalink_failovers_total: 0,
      player_migrations_total: 0,
      player_migration_failures_total: 0,
      player_recovery_total: 0,
      player_recovery_failures_total: 0,
      playback_resume_total: 0,
      playback_resume_failures_total: 0,
      node_disconnects_total: 0,
      node_reconnects_total: 0,
      migration_durations_ms: [],
      recovery_durations_ms: [],
    };

    this.recentEvents = [];
    this.maxRecentEvents = 100;
  }

  increment(metricName, value = 1) {
    if (typeof this.metrics[metricName] === 'number') {
      this.metrics[metricName] += value;
    }
  }

  recordMigrationDuration(durationMs) {
    if (typeof durationMs === 'number' && durationMs >= 0) {
      this.metrics.migration_durations_ms.push(durationMs);
      if (this.metrics.migration_durations_ms.length > 500) {
        this.metrics.migration_durations_ms.shift();
      }
    }
  }

  recordRecoveryDuration(durationMs) {
    if (typeof durationMs === 'number' && durationMs >= 0) {
      this.metrics.recovery_durations_ms.push(durationMs);
      if (this.metrics.recovery_durations_ms.length > 500) {
        this.metrics.recovery_durations_ms.shift();
      }
    }
  }

  getAverageDuration(array) {
    if (!array || array.length === 0) return 0;
    const sum = array.reduce((a, b) => a + b, 0);
    return Math.round(sum / array.length);
  }

  logEvent(eventType, metadata = {}) {
    const event = {
      type: eventType,
      guildId: metadata.guildId || 'N/A',
      playerId: metadata.playerId || metadata.guildId || 'N/A',
      oldNodeId: metadata.oldNodeId || 'N/A',
      newNodeId: metadata.newNodeId || 'N/A',
      trackId: metadata.trackId || metadata.trackTitle || 'N/A',
      migrationId: metadata.migrationId || 'N/A',
      reason: metadata.reason || 'N/A',
      durationMs: metadata.durationMs || 0,
      timestamp: new Date().toISOString(),
    };

    this.recentEvents.unshift(event);
    if (this.recentEvents.length > this.maxRecentEvents) {
      this.recentEvents.pop();
    }

    logger.info(`[ClusterEvent] ${eventType}:`, event);
  }

  getMetricsSummary() {
    return {
      lavalink_failovers_total: this.metrics.lavalink_failovers_total,
      player_migrations_total: this.metrics.player_migrations_total,
      player_migration_failures_total: this.metrics.player_migration_failures_total,
      player_recovery_total: this.metrics.player_recovery_total,
      player_recovery_failures_total: this.metrics.player_recovery_failures_total,
      playback_resume_total: this.metrics.playback_resume_total,
      playback_resume_failures_total: this.metrics.playback_resume_failures_total,
      node_disconnects_total: this.metrics.node_disconnects_total,
      node_reconnects_total: this.metrics.node_reconnects_total,
      average_migration_duration_ms: this.getAverageDuration(this.metrics.migration_durations_ms),
      average_recovery_duration_ms: this.getAverageDuration(this.metrics.recovery_durations_ms),
      recent_events_count: this.recentEvents.length,
    };
  }

  toPrometheusString() {
    const summary = this.getMetricsSummary();
    return `
# HELP lavalink_failovers_total Total number of triggered Lavalink failovers
# TYPE lavalink_failovers_total counter
lavalink_failovers_total ${summary.lavalink_failovers_total}

# HELP player_migrations_total Total number of player node migrations executed
# TYPE player_migrations_total counter
player_migrations_total ${summary.player_migrations_total}

# HELP player_migration_failures_total Total number of failed player node migrations
# TYPE player_migration_failures_total counter
player_migration_failures_total ${summary.player_migration_failures_total}

# HELP player_recovery_total Total number of player state recoveries executed
# TYPE player_recovery_total counter
player_recovery_total ${summary.player_recovery_total}

# HELP player_recovery_failures_total Total number of failed player state recoveries
# TYPE player_recovery_failures_total counter
player_recovery_failures_total ${summary.player_recovery_failures_total}

# HELP playback_resume_total Total number of successful playback resumes
# TYPE playback_resume_total counter
playback_resume_total ${summary.playback_resume_total}

# HELP playback_resume_failures_total Total number of failed playback resumes
# TYPE playback_resume_failures_total counter
playback_resume_failures_total ${summary.playback_resume_failures_total}

# HELP node_disconnects_total Total number of Lavalink node disconnect events
# TYPE node_disconnects_total counter
node_disconnects_total ${summary.node_disconnects_total}

# HELP node_reconnects_total Total number of Lavalink node reconnect events
# TYPE node_reconnects_total counter
node_reconnects_total ${summary.node_reconnects_total}

# HELP average_migration_duration_ms Average duration of player migration in milliseconds
# TYPE average_migration_duration_ms gauge
average_migration_duration_ms ${summary.average_migration_duration_ms}

# HELP average_recovery_duration_ms Average duration of player recovery in milliseconds
# TYPE average_recovery_duration_ms gauge
average_recovery_duration_ms ${summary.average_recovery_duration_ms}
`.trim();
  }
}

module.exports = new RecoveryMetrics();
