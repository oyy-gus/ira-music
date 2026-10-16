const { NodeHealthMonitor, NodeStatus } = require('../src/music/failover/NodeHealthMonitor');
const { PlayerMigrationManager, MigrationState } = require('../src/music/failover/PlayerMigrationManager');
const RecoveryLock = require('../src/music/failover/RecoveryLock');
const RecoveryMetrics = require('../src/music/failover/RecoveryMetrics');
const SessionPersistence = require('../src/music/failover/SessionPersistence');

describe('Persistent Multi-Lavalink Failover & Playback Recovery System', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('1. Multi-Node Health Monitoring & Status Evaluation', () => {
    test('should register and evaluate healthy node status', () => {
      const mockNode = {
        id: 'node-us-01',
        connected: true,
        options: { host: 'us-01.lavalink.local', port: 2333, region: 'US' },
        stats: {
          players: 5,
          playingPlayers: 3,
          uptime: 36000,
          cpu: { lavalinkLoad: 0.1, systemLoad: 0.2, cores: 4 },
          memory: { used: 100 * 1024 * 1024, free: 500 * 1024 * 1024, allocated: 600 * 1024 * 1024 },
        },
      };

      NodeHealthMonitor.registerNode(mockNode);
      const stats = NodeHealthMonitor.getNodeStats('node-us-01');

      expect(stats).toBeDefined();
      expect(stats.nodeId).toBe('node-us-01');
      expect(stats.status).toBe(NodeStatus.HEALTHY);
      expect(NodeHealthMonitor.isNodeUsable('node-us-01')).toBe(true);
    });

    test('should mark node as UNHEALTHY after consecutive errors', () => {
      const mockNode = {
        id: 'node-eu-01',
        connected: true,
        options: { host: 'eu-01.lavalink.local', port: 2333, region: 'EU' },
      };

      NodeHealthMonitor.registerNode(mockNode);
      NodeHealthMonitor.recordNodeError('node-eu-01', new Error('Timeout'));
      NodeHealthMonitor.recordNodeError('node-eu-01', new Error('Connection refused'));
      NodeHealthMonitor.recordNodeError('node-eu-01', new Error('Socket closed'));

      const stats = NodeHealthMonitor.getNodeStats('node-eu-01');
      expect(stats.status).toBe(NodeStatus.UNHEALTHY);
      expect(NodeHealthMonitor.isNodeUsable('node-eu-01')).toBe(false);
    });

    test('should respect DRAINING status and disallow new players', () => {
      const mockNode = {
        id: 'node-asia-01',
        connected: true,
        options: { host: 'asia-01.lavalink.local', port: 2333, region: 'ASIA' },
      };

      NodeHealthMonitor.registerNode(mockNode);
      NodeHealthMonitor.setDraining('node-asia-01', true);

      const stats = NodeHealthMonitor.getNodeStats('node-asia-01');
      expect(stats.status).toBe(NodeStatus.DRAINING);
      expect(NodeHealthMonitor.isNodeUsable('node-asia-01')).toBe(false);
    });
  });

  describe('2. Best Node Selection & Scoring', () => {
    test('should select the best healthy node based on latency, load and health', () => {
      const mockManager = {
        nodeManager: {
          nodes: new Map([
            [
              'node-busy',
              {
                id: 'node-busy',
                connected: true,
                options: { host: 'busy.lavalink.local', port: 2333 },
              },
            ],
            [
              'node-optimal',
              {
                id: 'node-optimal',
                connected: true,
                options: { host: 'optimal.lavalink.local', port: 2333 },
              },
            ],
          ]),
        },
      };

      NodeHealthMonitor.registerNode(mockManager.nodeManager.nodes.get('node-busy'));
      NodeHealthMonitor.registerNode(mockManager.nodeManager.nodes.get('node-optimal'));

      const statsBusy = NodeHealthMonitor.getNodeStats('node-busy');
      statsBusy.latency = 300;
      statsBusy.players = 50;

      const statsOpt = NodeHealthMonitor.getNodeStats('node-optimal');
      statsOpt.latency = 25;
      statsOpt.players = 2;

      const selected = PlayerMigrationManager.selectBestNode(mockManager, null);
      expect(selected).toBeDefined();
      expect(selected.id).toBe('node-optimal');
    });

    test('should exclude unhealthy and specified failed node from selection', () => {
      const mockManager = {
        nodeManager: {
          nodes: new Map([
            [
              'node-failed',
              {
                id: 'node-failed',
                connected: true,
                options: { host: 'failed.lavalink.local', port: 2333 },
              },
            ],
            [
              'node-backup',
              {
                id: 'node-backup',
                connected: true,
                options: { host: 'backup.lavalink.local', port: 2333 },
              },
            ],
          ]),
        },
      };

      NodeHealthMonitor.registerNode(mockManager.nodeManager.nodes.get('node-failed'));
      NodeHealthMonitor.registerNode(mockManager.nodeManager.nodes.get('node-backup'));

      const selected = PlayerMigrationManager.selectBestNode(mockManager, 'node-failed');
      expect(selected).toBeDefined();
      expect(selected.id).toBe('node-backup');
    });
  });

  describe('3. RecoveryLock & Duplicate Player Prevention', () => {
    test('should acquire and release lock properly', () => {
      const guildId = 'guild-12345';
      const ownerA = 'migration-task-1';
      const ownerB = 'migration-task-2';

      expect(RecoveryLock.acquire(guildId, ownerA, 10000)).toBe(true);
      expect(RecoveryLock.isLocked(guildId)).toBe(true);

      // Second attempt by different owner should fail
      expect(RecoveryLock.acquire(guildId, ownerB, 10000)).toBe(false);

      // Release lock
      expect(RecoveryLock.release(guildId, ownerA)).toBe(true);
      expect(RecoveryLock.isLocked(guildId)).toBe(false);

      // Now second owner can acquire
      expect(RecoveryLock.acquire(guildId, ownerB, 10000)).toBe(true);
      RecoveryLock.release(guildId, ownerB, true);
    });
  });

  describe('4. Migration Loop Protection', () => {
    test('should detect rapid successive migrations and trigger loop protection', () => {
      const guildId = 'guild-loop-test';
      expect(PlayerMigrationManager.checkLoopProtection(guildId, 'node-1')).toBe(true);
      expect(PlayerMigrationManager.checkLoopProtection(guildId, 'node-2')).toBe(true);
      expect(PlayerMigrationManager.checkLoopProtection(guildId, 'node-1')).toBe(true);
      // 4th attempt in short window triggers protection
      expect(PlayerMigrationManager.checkLoopProtection(guildId, 'node-2')).toBe(false);
    });
  });

  describe('5. Session State Snapshot & Persistence', () => {
    test('should accurately extract snapshot with position, queue, and settings', () => {
      const mockPlayer = {
        guildId: 'guild-999',
        voiceChannelId: 'vc-111',
        textChannelId: 'tc-222',
        volume: 85,
        repeatMode: 'track',
        position: 125000,
        playing: true,
        paused: false,
        get: (key) => (key === 'autoplay' ? true : null),
        node: { id: 'node-us-01' },
        queue: {
          current: {
            encoded: 'mock-encoded-track',
            info: {
              title: 'Never Gonna Give You Up',
              author: 'Rick Astley',
              duration: 213000,
              uri: 'https://youtube.com/watch?v=dQw4w9WgXcQ',
            },
            userData: { requesterId: 'user-777', requesterTag: 'RickFan#0001' },
          },
          tracks: [
            {
              encoded: 'mock-encoded-track-2',
              info: { title: 'Together Forever', author: 'Rick Astley', duration: 205000 },
            },
          ],
          previous: [],
        },
        filterManager: { data: { volume: 0.85 } },
      };

      const snapshot = SessionPersistence.extractSnapshot(mockPlayer);

      expect(snapshot).toBeDefined();
      expect(snapshot.guildId).toBe('guild-999');
      expect(snapshot.voiceChannelId).toBe('vc-111');
      expect(snapshot.volume).toBe(85);
      expect(snapshot.repeatMode).toBe('track');
      expect(snapshot.autoplay).toBe(true);
      expect(snapshot.position).toBe(125000);
      expect(snapshot.currentTrack.title).toBe('Never Gonna Give You Up');
      expect(snapshot.queue.length).toBe(1);
      expect(snapshot.status).toBe('PLAYING');
    });
  });

  describe('6. Metrics & Prometheus Export', () => {
    test('should increment counters and generate Prometheus format', () => {
      RecoveryMetrics.increment('lavalink_failovers_total');
      RecoveryMetrics.increment('player_migrations_total');
      RecoveryMetrics.increment('playback_resume_total');
      RecoveryMetrics.recordMigrationDuration(150);

      const summary = RecoveryMetrics.getMetricsSummary();
      expect(summary.lavalink_failovers_total).toBeGreaterThanOrEqual(1);
      expect(summary.player_migrations_total).toBeGreaterThanOrEqual(1);
      expect(summary.playback_resume_total).toBeGreaterThanOrEqual(1);

      const promStr = RecoveryMetrics.toPrometheusString();
      expect(promStr).toContain('lavalink_failovers_total');
      expect(promStr).toContain('player_migrations_total');
      expect(promStr).toContain('playback_resume_total');
    });
  });
});
