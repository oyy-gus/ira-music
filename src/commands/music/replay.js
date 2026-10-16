const { EmbedBuilder } = require('discord.js');
const { sendAutoDelete } = require('../../utils/channelUtils');
const { getEmoji } = require('../../config/emojis');
const { formatTrackTitle } = require('../../utils/titleUtils');

module.exports = {
  name: 'replay',
  description: 'Replay the currently playing track from the beginning',
  aliases: ['restarttrack'],
  category: 'music',
  cooldown: 2,
  async execute({ message }) {
    const client = message.client;
    const gEmoji = (key) => { const e = getEmoji(key, client); return e ? `${e} ` : ''; };
    const player = message.client.lavalink?.players.get(message.guild.id);
    if (!player || !player.connected || !player.queue.current) {
      const embed = new EmbedBuilder()
        .setTitle(`${gEmoji('error')}Session Error`)
        .setDescription('No active track playing to replay.')
        .setColor(0xED4245);
      return sendAutoDelete(message.reply({ embeds: [embed] }), 6000);
    }

    await player.seek(0);

    const cleanTitle = formatTrackTitle(player.queue.current.info.title, 50);
    const embed = new EmbedBuilder()
      .setTitle(`${gEmoji('track_replay')}Track Replaying`)
      .setDescription(`Replaying **[${cleanTitle}](${player.queue.current.info.uri || ''})** from \`00:00\`.`)
      .setColor(0x57F287);
    return sendAutoDelete(message.reply({ embeds: [embed] }), 12000);
  },
};
