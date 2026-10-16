const { Client, GatewayIntentBits } = require('discord.js');
const config = require('./config');
const logger = require('./logger/logger');
const { loadCommands } = require('./handlers/commandHandler');
const { loadEvents } = require('./handlers/eventHandler');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

const { connectDB } = require('./database/connection');
const { startHealthServer } = require('./services/healthService');
const { setupGracefulShutdown } = require('./utils/gracefulShutdown');

// Connect to MongoDB
connectDB();

// Start Analytics Aggregation Worker
const aggregationWorker = require('./analytics/aggregationWorker');
aggregationWorker.start();

// Load handlers
loadCommands(client);
loadEvents(client);

// Start HTTP Health & Metrics Server
const healthServer = startHealthServer(client, process.env.PORT || 3000);

// Setup Graceful Shutdown Listeners
setupGracefulShutdown(client, healthServer);

// Uncaught exception and unhandled rejection protection
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception detected:', { error: error.message, stack: error.stack });
});

process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled Rejection detected:', { reason: reason instanceof Error ? reason.message : reason });
});

if (config.discord.token) {
  client.login(config.discord.token).catch((err) => {
    logger.error('Failed to log in to Discord:', { error: err.message });
  });
} else {
  logger.warn('DISCORD_TOKEN is missing in environment settings. Please configure .env file.');
}

module.exports = client;
