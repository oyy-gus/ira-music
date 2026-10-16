const { EmbedBuilder } = require('discord.js');
const SessionPersistence = require('../../music/failover/SessionPersistence');
const { sendAutoDelete } = require('../../utils/channelUtils');
const { getEmoji } = require('../../config/emojis');

module.exports = {
  name: 'shuffle',
  description: 'Randomize the order of tracks in queue',
  category: 'music',
  cooldown: 2,
  async execute({ message, client }) {
    const gEmoji = (key) => { const e = getEmoji(key, client); return e ? `${e} ` : ''; };
    const player = client.lavalink?.players.get(message.guild.id);
    if (!player || !player.connected || player.queue.tracks.length === 0) {
      const embed = new EmbedBuilder()
        .setTitle(`${gEmoji('error')}Queue Empty`)
        .setDescription('No tracks in queue to shuffle.')
        .setColor(0xED4245);
      return sendAutoDelete(message.reply({ embeds: [embed] }), 6000);
    }

    if (!message.member.voice.channel || message.member.voice.channel.id !== player.voiceChannelId) {
      const embed = new EmbedBuilder()
        .setTitle(`${gEmoji('error')}Voice Channel Mismatch`)
        .setDescription('You must be in the same voice channel as the bot to shuffle!')
        .setColor(0xED4245);
      return sendAutoDelete(message.reply({ embeds: [embed] }), 6000);
    }

    player.queue.shuffle();
    SessionPersistence.saveSnapshot(player, true);

    const embed = new EmbedBuilder()
      .setTitle(`${gEmoji('shuffle')}Queue Shuffled`)
      .setDescription(`**${player.queue.tracks.length}** tracks have been shuffled.`)
      .setColor(0x5865F2);
    return sendAutoDelete(message.reply({ embeds: [embed] }), 12000);
  },
};
