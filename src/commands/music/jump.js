const { EmbedBuilder } = require('discord.js');
const SessionPersistence = require('../../music/failover/SessionPersistence');
const { sendAutoDelete } = require('../../utils/channelUtils');
const { getEmoji } = require('../../config/emojis');

module.exports = {
  name: 'jump',
  description: 'Jump to a specific track position in the queue',
  aliases: ['skipto'],
  category: 'music',
  cooldown: 2,
  async execute({ message, args, prefix }) {
    const client = message.client;
    const gEmoji = (key) => { const e = getEmoji(key, client); return e ? `${e} ` : ''; };
    const player = message.client.lavalink?.players.get(message.guild.id);
    if (!player || !player.connected || player.queue.tracks.length === 0) {
      const embed = new EmbedBuilder()
        .setTitle(`${gEmoji('error')}Session Error`)
        .setDescription('No active queue to jump within.')
        .setColor(0xED4245);
      return sendAutoDelete(message.reply({ embeds: [embed] }), 6000);
    }

    if (!args[0]) {
      const embed = new EmbedBuilder()
        .setTitle(`${gEmoji('error')}Missing Position`)
        .setDescription(`Usage: \`${prefix}jump <position>\`\nExample: \`${prefix}jump 5\``)
        .setColor(0xED4245);
      return sendAutoDelete(message.reply({ embeds: [embed] }), 6000);
    }

    const pos = parseInt(args[0], 10);
    const queueLen = player.queue.tracks.length;
    if (isNaN(pos) || pos < 1 || pos > queueLen) {
      const embed = new EmbedBuilder()
        .setTitle(`${gEmoji('error')}Invalid Position`)
        .setDescription(`Position must be a number between **1** and **${queueLen}**.`)
        .setColor(0xED4245);
      return sendAutoDelete(message.reply({ embeds: [embed] }), 6000);
    }

    // Remove preceding tracks before target position
    if (pos > 1) {
      player.queue.tracks.splice(0, pos - 1);
    }

    await player.skip();
    SessionPersistence.saveSnapshot(player, true);

    const targetTrack = player.queue.current;
    const embed = new EmbedBuilder()
      .setTitle(`${gEmoji('jump')}Jumped Queue`)
      .setDescription(`Jumped to track **#${pos}**: **[${targetTrack?.info?.title || 'Track'}](${targetTrack?.info?.uri || ''})**`)
      .setColor(0x57F287);
    return sendAutoDelete(message.reply({ embeds: [embed] }), 12000);
  },
};
