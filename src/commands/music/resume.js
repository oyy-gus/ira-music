const { EmbedBuilder } = require('discord.js');
const SessionPersistence = require('../../music/failover/SessionPersistence');
const { sendAutoDelete } = require('../../utils/channelUtils');
const { getEmoji } = require('../../config/emojis');

module.exports = {
  name: 'resume',
  description: 'Resume paused audio playback',
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
        .setDescription('You must be in the same voice channel as the bot to resume!')
        .setColor(0xED4245);
      return sendAutoDelete(message.reply({ embeds: [embed] }), 6000);
    }

    if (!player.paused) {
      const embed = new EmbedBuilder()
        .setTitle(`${gEmoji('error')}Already Playing`)
        .setDescription('Playback is already running.')
        .setColor(0xFEE75C);
      return sendAutoDelete(message.reply({ embeds: [embed] }), 6000);
    }

    await player.resume();
    SessionPersistence.saveSnapshot(player, true, 'PLAYING');

    const embed = new EmbedBuilder()
      .setTitle(`${gEmoji('resume')}Playback Resumed`)
      .setDescription('Audio playback has been resumed.')
      .setColor(0x57F287);
    return sendAutoDelete(message.reply({ embeds: [embed] }), 10000);
  },
};
