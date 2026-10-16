const { EmbedBuilder } = require('discord.js');
const SessionPersistence = require('../../music/failover/SessionPersistence');
const { sendAutoDelete } = require('../../utils/channelUtils');
const { getEmoji } = require('../../config/emojis');
const { formatTrackTitle } = require('../../utils/titleUtils');

module.exports = {
  name: 'move',
  description: 'Move a track from one queue position to another',
  aliases: ['mv'],
  category: 'music',
  cooldown: 2,
  async execute({ message, args, prefix }) {
    const client = message.client;
    const gEmoji = (key) => { const e = getEmoji(key, client); return e ? `${e} ` : ''; };
    const player = message.client.lavalink?.players.get(message.guild.id);
    if (!player || !player.connected || player.queue.tracks.length < 2) {
      const embed = new EmbedBuilder()
        .setTitle(`${gEmoji('error')}Move Error`)
        .setDescription('You need at least 2 tracks in the queue to move positions.')
        .setColor(0xED4245);
      return sendAutoDelete(message.reply({ embeds: [embed] }), 6000);
    }

    if (!args[0] || !args[1]) {
      const embed = new EmbedBuilder()
        .setTitle(`${gEmoji('error')}Missing Arguments`)
        .setDescription(`Usage: \`${prefix}move <from_position> <to_position>\`\nExample: \`${prefix}move 8 2\``)
        .setColor(0xED4245);
      return sendAutoDelete(message.reply({ embeds: [embed] }), 6000);
    }

    const fromPos = parseInt(args[0], 10);
    const toPos = parseInt(args[1], 10);
    const queueLen = player.queue.tracks.length;

    if (isNaN(fromPos) || isNaN(toPos) || fromPos < 1 || fromPos > queueLen || toPos < 1 || toPos > queueLen) {
      const embed = new EmbedBuilder()
        .setTitle(`${gEmoji('error')}Invalid Position`)
        .setDescription(`Positions must be numbers between **1** and **${queueLen}**.`)
        .setColor(0xED4245);
      return sendAutoDelete(message.reply({ embeds: [embed] }), 6000);
    }

    const [movedTrack] = player.queue.tracks.splice(fromPos - 1, 1);
    player.queue.tracks.splice(toPos - 1, 0, movedTrack);
    SessionPersistence.saveSnapshot(player, true);

    const cleanTitle = formatTrackTitle(movedTrack.info.title, 50);
    const embed = new EmbedBuilder()
      .setTitle(`${gEmoji('move_track')}Track Moved`)
      .setDescription(`Moved **[${cleanTitle}](${movedTrack.info.uri || ''})** from position **#${fromPos}** to **#${toPos}**.`)
      .setColor(0x57F287);
    return sendAutoDelete(message.reply({ embeds: [embed] }), 12000);
  },
};
