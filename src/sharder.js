const { ShardingManager } = require('discord.js');
const path = require('path');
const config = require('./config');
const logger = require('./logger/logger');

if (!config.discord.token) {
  logger.error('[Sharder] Discord bot token is missing!');
  process.exit(1);
}

const manager = new ShardingManager(path.join(__dirname, 'index.js'), {
  token: config.discord.token,
  totalShards: 'auto',
  respawn: true,
});

manager.on('shardCreate', (shard) => {
  logger.info(`[Sharder] Spawned Shard #${shard.id}`);

  shard.on('ready', () => {
    logger.info(`[Sharder] Shard #${shard.id} is ready`);
  });

  shard.on('disconnect', () => {
    logger.warn(`[Sharder] Shard #${shard.id} disconnected`);
  });

  shard.on('reconnecting', () => {
    logger.info(`[Sharder] Shard #${shard.id} reconnecting...`);
  });

  shard.on('death', (process) => {
    logger.error(`[Sharder] Shard #${shard.id} process exited with code ${process.exitCode}`);
  });
});

manager.spawn().catch((error) => {
  logger.error('[Sharder] Error spawning shards:', { error: error.message || error });
});
