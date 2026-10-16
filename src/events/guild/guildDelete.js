const logger = require('../../logger/logger');
const WebhookLogger = require('../../services/webhookLogger');

module.exports = {
  name: 'guildDelete',
  once: false,
  async execute(guild, client) {
    logger.info(`[GuildLeave] Bot removed from server: ${guild.name} (${guild.id})`);

    // Send Invite Webhook Log
    await WebhookLogger.sendInviteLog({
      event: 'GUILD_LEAVE',
      guild,
      client,
    });
  },
};
