const { EmbedBuilder } = require('discord.js');
const SessionPersistence = require('../../music/failover/SessionPersistence');
const { sendAutoDelete } = require('../../utils/channelUtils');
const { getEmoji } = require('../../config/emojis');

module.exports = {
  name: 'volume',
  description: 'Adjust audio playback volume (1-150%)',
  aliases: ['vol', 'v'],
  category: 'music',
  cooldown: 2,
  async execute({ message, args, client, prefix }) {
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
        .setDescription('You must be in the same voice channel as the bot to change volume!')
        .setColor(0xED4245);
      return sendAutoDelete(message.reply({ embeds: [embed] }), 6000);
    }

    if (!args[0]) {
      const embed = new EmbedBuilder()
        .setTitle(`${gEmoji('playback_volume')}Playback Volume`)
        .setDescription(`Current playback volume: **${player.volume}%**`)
        .setColor(0x5865F2);
      return sendAutoDelete(message.reply({ embeds: [embed] }), 10000);
    }

    const newVolume = parseInt(args[0], 10);
    if (isNaN(newVolume) || newVolume < 1 || newVolume > 150) {
      const embed = new EmbedBuilder()
        .setTitle(`${gEmoji('error')}Invalid Volume`)
        .setDescription(`Please specify a valid volume between **1** and **150**.\n\n**Usage:** \`${prefix}volume 80\``)
        .setColor(0xED4245);
      return sendAutoDelete(message.reply({ embeds: [embed] }), 6000);
    }

    await player.setVolume(newVolume);
    SessionPersistence.saveSnapshot(player, true);

    const embed = new EmbedBuilder()
      .setTitle(`${gEmoji('volume_updated')}Volume Updated`)
      .setDescription(`Playback volume set to **${newVolume}%**.`)
      .setColor(0x57F287);
    return sendAutoDelete(message.reply({ embeds: [embed] }), 10000);
  },
};
