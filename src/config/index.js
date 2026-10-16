'use strict';

require('dotenv').config();

const startupMessages = [];

/**
 * Parse Lavalink Nodes configuration from environment variable or provide fallback.
 * @returns {Array<Object>} Lavalink nodes configuration array.
 */
const parseLavalinkNodes = () => {
  const rawNodes = process.env.LAVALINK_NODES;
  if (rawNodes) {
    try {
      const parsed = JSON.parse(rawNodes);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    } catch (error) {
      startupMessages.push([
        'warn',
        '[Config] Failed to parse LAVALINK_NODES JSON string. Falling back to default node configuration.',
        { error: error.message },
      ]);
    }
  }

  // Fallback Lavalink Node (Localhost default for quick developer onboarding)
  return [
    {
      id: process.env.LAVALINK_ID || 'Local-Node',
      host: process.env.LAVALINK_HOST || '127.0.0.1',
      port: parseInt(process.env.LAVALINK_PORT || '2333', 10),
      authorization: process.env.LAVALINK_PASSWORD || 'youshallnotpass',
      secure: process.env.LAVALINK_SECURE === 'true',
      retryAmount: parseInt(process.env.LAVALINK_RETRY_AMOUNT || '5', 10),
      retryDelay: parseInt(process.env.LAVALINK_RETRY_DELAY || '5000', 10),
      region: process.env.LAVALINK_REGION || 'US',
    },
  ];
};

const clientId = process.env.DISCORD_CLIENT_ID || '';

const config = {
  discord: {
    token: process.env.DISCORD_TOKEN || '',
    clientId,
    ownerId: process.env.OWNER_ID || '',
    defaultPrefix: process.env.DEFAULT_PREFIX || '*',
    inviteUrl:
      process.env.BOT_INVITE_URL ||
      (clientId
        ? `https://discord.com/oauth2/authorize?client_id=${clientId}&permissions=4803659530890592&scope=bot+applications.commands`
        : 'https://discord.com/oauth2/authorize'),
    supportServerUrl: process.env.SUPPORT_SERVER_URL || 'https://discord.gg/vabruGDuAe',
  },
  web: {
    enabled: process.env.WEB_ENABLED !== 'false',
    port: parseInt(process.env.PORT || '3000', 10),
    redirectUri: process.env.DISCORD_REDIRECT_URI || 'http://localhost:3000/auth/discord/callback',
    clientSecret: process.env.DISCORD_CLIENT_SECRET || '',
  },
  database: {
    uri: process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/ira-music',
  },
  lavalink: {
    nodes: parseLavalinkNodes(),
  },
  app: {
    env: process.env.NODE_ENV || 'development',
    logLevel: process.env.LOG_LEVEL || 'info',
  },
  webhooks: {
    system: process.env.WEBHOOK_SYSTEM_URL || process.env.WEBHOOK_URL || '',
    invite: process.env.WEBHOOK_INVITE_URL || process.env.WEBHOOK_URL || '',
    command: process.env.WEBHOOK_COMMAND_URL || process.env.WEBHOOK_URL || '',
    music: process.env.WEBHOOK_MUSIC_URL || process.env.WEBHOOK_URL || '',
  },
  ...require('./emojis'),
};

module.exports = config;

const logger = require('../logger/logger');

startupMessages.forEach(([level, msg, meta]) => logger[level](msg, meta));

// Open-Source Startup Warning for unconfigured credentials
if (!config.discord.token && config.app.env !== 'test') {
  logger.warn('[Config] DISCORD_TOKEN is missing! Please configure your .env file before running.');
}
if (!process.env.MONGODB_URI && config.app.env !== 'test') {
  logger.info('[Config] MONGODB_URI not provided; attempting default local connection: mongodb://127.0.0.1:27017/ira-music');
}