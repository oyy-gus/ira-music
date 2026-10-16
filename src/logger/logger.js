const winston = require('winston');
const config = require('../config');

const customFormat = winston.format.printf(({ timestamp, level, message, service, guildId, userId, shardId, nodeId, command, event, ...meta }) => {
  const contextData = {
    ...(guildId && { guildId }),
    ...(userId && { userId }),
    ...(shardId !== undefined && { shardId }),
    ...(nodeId && { nodeId }),
    ...(command && { command }),
    ...(event && { event }),
    ...meta,
  };

  const contextStr = Object.keys(contextData).length > 0 ? ` ${JSON.stringify(contextData)}` : '';
  return `[${timestamp}] [${level.toUpperCase()}] [${service || 'BotCore'}]: ${message}${contextStr}`;
});

const logger = winston.createLogger({
  level: config.app.logLevel,
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'ira-music' },
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        winston.format.colorize(),
        customFormat
      ),
    }),
    new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/combined.log' }),
  ],
});

module.exports = logger;
