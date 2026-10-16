const { EmbedBuilder } = require('discord.js');
const { sendAutoDelete } = require('../../utils/channelUtils');
const { getEmoji } = require('../../config/emojis');

module.exports = {
  name: 'stop',
  description: 'Stop playback, clear queue, and leave voice channel',
  aliases: ['dc', 'disconnect'],
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
        .setDescription('You must be in the same voice channel as the bot to stop!')
        .setColor(0xED4245);
      return sendAutoDelete(message.reply({ embeds: [embed] }), 6000);
    }

    await player.destroy();
    const embed = new EmbedBuilder()
      .setTitle(`${gEmoji('stop')}Session Stopped`)
      .setDescription('Playback stopped, queue cleared, and disconnected from voice channel.')
      .setColor(0xED4245);
    return sendAutoDelete(message.reply({ embeds: [embed] }), 10000);
  },
};
