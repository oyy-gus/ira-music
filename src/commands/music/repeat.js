const { EmbedBuilder } = require('discord.js');
const SessionPersistence = require('../../music/failover/SessionPersistence');
const { sendAutoDelete } = require('../../utils/channelUtils');
const { getEmoji } = require('../../config/emojis');

module.exports = {
  name: 'repeat',
  description: 'Set repeat mode (*repeat track / *repeat queue / *repeat off)',
  aliases: ['loop'],
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
        .setDescription('You must be in the same voice channel as the bot!')
        .setColor(0xED4245);
      return sendAutoDelete(message.reply({ embeds: [embed] }), 6000);
    }

    const mode = args[0] ? args[0].toLowerCase() : null;

    if (!mode) {
      const embed = new EmbedBuilder()
        .setTitle(`${gEmoji('repeat')}Repeat Mode`)
        .setDescription(`Current repeat mode: **${player.repeatMode || 'off'}**`)
        .addFields({ name: 'Options', value: `\`${prefix}repeat track\` · \`${prefix}repeat queue\` · \`${prefix}repeat off\`` })
        .setColor(0x5865F2);
      return sendAutoDelete(message.reply({ embeds: [embed] }), 12000);
    }

    if (mode === 'track' || mode === 'song') {
      player.setRepeatMode('track');
      SessionPersistence.saveSnapshot(player, true);
      const embed = new EmbedBuilder()
        .setTitle(`${gEmoji('repeat_one')}Repeat: Track`)
        .setDescription('Repeat mode set to **TRACK**. The current song will loop.')
        .setColor(0x57F287);
      return sendAutoDelete(message.reply({ embeds: [embed] }), 12000);
    } else if (mode === 'queue' || mode === 'all') {
      player.setRepeatMode('queue');
      SessionPersistence.saveSnapshot(player, true);
      const embed = new EmbedBuilder()
        .setTitle(`${gEmoji('repeat')}Repeat: Queue`)
        .setDescription('Repeat mode set to **QUEUE**. The entire queue will loop.')
        .setColor(0x57F287);
      return sendAutoDelete(message.reply({ embeds: [embed] }), 12000);
    } else if (mode === 'off' || mode === 'disable') {
      player.setRepeatMode('off');
      SessionPersistence.saveSnapshot(player, true);
      const embed = new EmbedBuilder()
        .setTitle(`${gEmoji('repeat')}Repeat: Off`)
        .setDescription('Repeat mode turned **OFF**.')
        .setColor(0x5865F2);
      return sendAutoDelete(message.reply({ embeds: [embed] }), 12000);
    } else {
      const embed = new EmbedBuilder()
        .setTitle(`${gEmoji('error')}Invalid Mode`)
        .setDescription(`Options: \`${prefix}repeat track\`, \`${prefix}repeat queue\`, \`${prefix}repeat off\``)
        .setColor(0xED4245);
      return sendAutoDelete(message.reply({ embeds: [embed] }), 6000);
    }
  },
};
