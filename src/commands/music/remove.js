const { EmbedBuilder } = require('discord.js');
const SessionPersistence = require('../../music/failover/SessionPersistence');
const { sendAutoDelete } = require('../../utils/channelUtils');
const { getEmoji } = require('../../config/emojis');
const { formatTrackTitle } = require('../../utils/titleUtils');

module.exports = {
  name: 'remove',
  description: 'Remove a specific track from the queue by position',
  aliases: ['rm', 'removetrack'],
  category: 'music',
  cooldown: 2,
  async execute({ message, args, prefix }) {
    const client = message.client;
    const gEmoji = (key) => { const e = getEmoji(key, client); return e ? `${e} ` : ''; };
    const player = message.client.lavalink?.players.get(message.guild.id);
    if (!player || !player.connected || player.queue.tracks.length === 0) {
      const embed = new EmbedBuilder()
        .setTitle(`${gEmoji('error')}Queue Empty`)
        .setDescription('There are no tracks in the queue to remove.')
        .setColor(0xED4245);
      return sendAutoDelete(message.reply({ embeds: [embed] }), 6000);
    }

    if (!args[0]) {
      const embed = new EmbedBuilder()
        .setTitle(`${gEmoji('error')}Missing Position`)
        .setDescription(`Usage: \`${prefix}remove <position>\`\nExample: \`${prefix}remove 3\``)
        .setColor(0xED4245);
      return sendAutoDelete(message.reply({ embeds: [embed] }), 6000);
    }

    const pos = parseInt(args[0], 10);
    if (isNaN(pos) || pos < 1 || pos > player.queue.tracks.length) {
      const embed = new EmbedBuilder()
        .setTitle(`${gEmoji('error')}Invalid Position`)
        .setDescription(`Please specify a valid position between **1** and **${player.queue.tracks.length}**.`)
        .setColor(0xED4245);
      return sendAutoDelete(message.reply({ embeds: [embed] }), 6000);
    }

    const removedTrack = player.queue.tracks.splice(pos - 1, 1)[0];
    SessionPersistence.saveSnapshot(player, true);
    const cleanTitle = formatTrackTitle(removedTrack.info.title, 50);

    const embed = new EmbedBuilder()
      .setTitle(`${gEmoji('trash')}Track Removed`)
      .setDescription(`Removed track **#${pos}**: **[${cleanTitle}](${removedTrack.info.uri || ''})**`)
      .setColor(0x57F287);
    return sendAutoDelete(message.reply({ embeds: [embed] }), 12000);
  },
};
