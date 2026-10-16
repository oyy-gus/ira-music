const mongoose = require('mongoose');
const logger = require('../logger/logger');
const SessionPersistence = require('../music/failover/SessionPersistence');

let isShuttingDown = false;

const setupGracefulShutdown = (client, server) => {
  const shutdown = async (signal) => {
    if (isShuttingDown) return;
    isShuttingDown = true;

    logger.info(`Received ${signal}. Initiating graceful shutdown & playback persistence process...`);

    try {
      // 1. Close HTTP server so new requests are not accepted
      if (server) {
        server.close();
        logger.info('HTTP health server closed.');
      }

      // 2. Persist all active player sessions to MongoDB
      if (client.lavalink) {
        await SessionPersistence.persistAllImmediate(client, 'SAVED_FOR_RESTART');
        SessionPersistence.stop();

        // Disconnect voice states cleanly without triggering destructive events
        for (const [, player] of client.lavalink.players) {
          try {
            if (typeof player.disconnect === 'function') {
              await player.disconnect();
            }
          } catch (e) {
            // Ignore disconnect errors during exit
          }
        }
        logger.info('All active Lavalink player sessions saved for restart recovery.');
      }

      // 3. Disconnect MongoDB cleanly
      if (mongoose.connection.readyState === 1) {
        await mongoose.disconnect();
        logger.info('MongoDB connection closed cleanly.');
      }

      // 4. Destroy Discord Client
      if (client) {
        client.destroy();
        logger.info('Discord client destroyed.');
      }

      logger.info('Graceful shutdown completed successfully. Exiting process.');
      process.exit(0);
    } catch (error) {
      logger.error('Error encountered during graceful shutdown:', { error: error.message });
      process.exit(1);
    }
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
};

module.exports = {
  setupGracefulShutdown,
  isShuttingDown: () => isShuttingDown,
};
