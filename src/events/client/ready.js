const logger = require('../../logger/logger');
const { initLavalink } = require('../../music/node-manager/nodeManager');
const RecoveryManager = require('../../music/failover/RecoveryManager');
const TwentyFourSevenGuard = require('../../music/failover/TwentyFourSevenGuard');
const WebhookLogger = require('../../services/webhookLogger');
const { fetchEmojis } = require('../../config/emojis');
const { loadSlashCommands, deploySlashCommands } = require('../../handlers/slashHandler');
const listeningTracker = require('../../services/listeningTracker');
const playerSessionRepo = require('../../database/repositories/playerSessionRepository');

module.exports = {
  name: 'clientReady',
  once: true,
  execute(client) {
    logger.info(`Bot successfully logged in as ${client.user.tag}!`, {
      guildsCount: client.guilds.cache.size,
      usersCount: client.users.cache.size,
      shardId: client.shard ? client.shard.ids[0] : 0,
    });

    // Store Client reference for Webhook Logger
    WebhookLogger.setClient(client);

    // Send System Webhook Log
    WebhookLogger.sendSystemLog({
      title: 'Bot Online & System Ready',
      description: `Bot successfully logged in as **${client.user.tag}**`,
      level: 'success',
      fields: [
        { name: '🤖 Bot User', value: `${client.user.tag} (\`${client.user.id}\`)`, inline: true },
        { name: '🏰 Servers', value: `\`${client.guilds.cache.size}\` servers`, inline: true },
        { name: '👤 Cached Users', value: `\`${client.users.cache.size}\` users`, inline: true },
        { name: '🆔 Shard ID', value: `\`${client.shard ? client.shard.ids[0] : 0}\``, inline: true },
      ],
    });

    // Fetch Bot Application Emojis
    fetchEmojis(client).then(() => {
      logger.info('[Ready] Bot application emojis fetched.');
    }).catch((err) => {
      logger.warn('[Ready] Could not fetch application emojis:', { error: err.message });
    });

    // Start Listening Tracker Service
    listeningTracker.start(client);

    // Initialize Multi-Lavalink Cluster Node Manager
    initLavalink(client);
    client.lavalink.init({ id: client.user.id, username: client.user.username });

    // Initialize Atlantis Service (reminders, bans cache, huntbot recovery, auto-mod)
    const atlantisService = require('../../services/atlantis/atlantisService');
    atlantisService.init(client);

    // Start 24/7 guard heartbeat - catches silent disconnects even without voiceStateUpdate
    TwentyFourSevenGuard.startHeartbeat(client);

    // Load & deploy global Slash Commands
    loadSlashCommands(client);
    deploySlashCommands(client).catch((err) => {
      logger.error('[Ready] Error deploying Slash Commands:', { error: err.message });
    });

    // Startup Session Recovery check
    setTimeout(async () => {
      // Clean up stale database sessions older than 24 hours first
      await playerSessionRepo.cleanupStaleSessions(24 * 60 * 60 * 1000).catch(() => {});

      RecoveryManager.recoverAllSessions(client, 'STARTUP').catch((err) => {
        logger.error('[Ready] Error running startup playback recovery:', { error: err.message });
      });
    }, 4000);

    client.user.setPresence({
      activities: [{ name: '*help | /help', type: 2 }],
      status: 'online',
    });
  },
};
