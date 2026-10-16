const logger = require('../logger/logger');

/**
 * Clean up previous bot messages in a text channel
 * @param {Object} client - Discord Client
 * @param {string} channelId - Channel ID
 * @param {number} limit - Number of recent messages to check (default 10)
 */
const cleanupPreviousBotMessages = async (client, channelId, limit = 10) => {
  if (!client || !channelId) return;
  try {
    const channel = client.channels.cache.get(channelId);
    if (!channel || !channel.isTextBased()) return;

    const messages = await channel.messages.fetch({ limit });
    const botMessages = messages.filter((m) => m.author.id === client.user.id);

    for (const [, msg] of botMessages) {
      try {
        await msg.delete();
      } catch (err) {
        // Ignore if message already deleted or missing Manage Messages permission
      }
    }
  } catch (err) {
    logger.debug(`[ChannelUtils] Could not clean up previous messages in channel ${channelId}: ${err.message}`);
  }
};

/**
 * Helper to auto-delete a sent Discord message after a delay
 * @param {Promise<Message>|Message} messagePromise
 * @param {number} deleteMs - Milliseconds before deleting (default 6000)
 */
const sendAutoDelete = (messagePromise, deleteMs = 6000) => {
  return Promise.resolve(messagePromise)
    .then((sentMsg) => {
      // Only auto-delete messages sent in guild channels, preserve DM responses
      if (sentMsg && sentMsg.guild && typeof sentMsg.delete === 'function' && deleteMs > 0) {
        setTimeout(() => sentMsg.delete().catch(() => {}), deleteMs);
      }
      return sentMsg;
    })
    .catch(() => {});
};

module.exports = {
  cleanupPreviousBotMessages,
  sendAutoDelete,
};
