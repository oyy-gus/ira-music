const logger = require('../../logger/logger');
const WebhookLogger = require('../../services/webhookLogger');

module.exports = {
  name: 'guildCreate',
  once: false,
  async execute(guild, client) {
    logger.info(`[GuildJoin] Bot added to server: ${guild.name} (${guild.id})`, {
      memberCount: guild.memberCount,
      ownerId: guild.ownerId,
    });

    // Send Invite Webhook Log
    await WebhookLogger.sendInviteLog({
      event: 'GUILD_JOIN',
      guild,
      client,
    });
  },
};
