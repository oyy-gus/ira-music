const { EmbedBuilder } = require('discord.js');
const logger = require('../../logger/logger');
const { getEmoji } = require('../../config/emojis');

module.exports = {
  name: 'shutdown',
  description: 'Safely shut down the bot client',
  aliases: ['off', 'exit', 'stopbot'],
  category: 'developer',
  ownerOnly: true,
  cooldown: 0,
  async execute({ message, client }) {
    const embed = new EmbedBuilder()
      .setTitle(`${getEmoji('stop', client)} Shutting Down...`)
      .setDescription('Disconnecting voice connections and stopping the bot gracefully.')
      .setColor(0xED4245)
      .setTimestamp();

    await message.reply({ embeds: [embed] });

    logger.info(`[Shutdown] Bot shutdown requested by developer ${message.author.tag} (${message.author.id})`);

    // Destroy active players if lavalink client exists
    if (client.lavalink) {
      try {
        for (const [, player] of client.lavalink.players) {
          await player.destroy();
        }
      } catch (err) {
        logger.error('[Shutdown] Error destroying Lavalink players:', err);
      }
    }

    // Destroy client and exit
    client.destroy();
    process.exit(0);
  },
};
