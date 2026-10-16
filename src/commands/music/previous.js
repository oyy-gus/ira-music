const { EmbedBuilder } = require('discord.js');
const { sendAutoDelete } = require('../../utils/channelUtils');
const { getEmoji } = require('../../config/emojis');
const { formatTrackTitle } = require('../../utils/titleUtils');

module.exports = {
  name: 'previous',
  description: 'Play the previous track from history',
  aliases: ['back', 'prev'],
  category: 'music',
  cooldown: 2,
  async execute({ message, client }) {
    const gEmoji = (key) => { const e = getEmoji(key, client); return e ? `${e} ` : ''; };
    const player = client.lavalink?.players.get(message.guild.id);
    if (!player || !player.connected) {
      const embed = new EmbedBuilder()
        .setTitle(`${gEmoji('error')}Session Error`)
        .setDescription('No active music session in this server.')
        .setColor(0xED4245);
      return sendAutoDelete(message.reply({ embeds: [embed] }), 6000);
    }

    if (!message.member.voice.channel || message.member.voice.channel.id !== player.voiceChannelId) {
      const embed = new EmbedBuilder()
        .setTitle(`${gEmoji('error')}Voice Channel Mismatch`)
        .setDescription('You must be in the same voice channel as the bot to play the previous track!')
        .setColor(0xED4245);
      return sendAutoDelete(message.reply({ embeds: [embed] }), 6000);
    }

    if (!player.queue.previous || player.queue.previous.length === 0) {
      const embed = new EmbedBuilder()
        .setTitle(`${gEmoji('error')}Previous Track Error`)
        .setDescription('There are no previous tracks in the history for this session.')
        .setColor(0xED4245);
      return sendAutoDelete(message.reply({ embeds: [embed] }), 6000);
    }

    const prevTrack = player.queue.previous.pop();
    if (!prevTrack) {
      const embed = new EmbedBuilder()
        .setTitle(`${gEmoji('error')}Previous Track Error`)
        .setDescription('Failed to retrieve previous track from history.')
        .setColor(0xED4245);
      return sendAutoDelete(message.reply({ embeds: [embed] }), 6000);
    }

    // Insert previous track at the beginning of the queue and skip current
    player.queue.tracks.unshift(prevTrack);
    await player.skip();

    const cleanTitle = formatTrackTitle(prevTrack.info.title, 50);
    const embed = new EmbedBuilder()
      .setTitle(`${gEmoji('prev')}Playing Previous Track`)
      .setDescription(`Now playing: **[${cleanTitle}](${prevTrack.info.uri || ''})**`)
      .setColor(0x57F287);
    return sendAutoDelete(message.reply({ embeds: [embed] }), 10000);
  },
};

