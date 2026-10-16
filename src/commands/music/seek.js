const { EmbedBuilder } = require('discord.js');
const SessionPersistence = require('../../music/failover/SessionPersistence');
const { sendAutoDelete } = require('../../utils/channelUtils');
const { getEmoji } = require('../../config/emojis');
const { formatDuration } = require('../../utils/timeUtils');

const parseTimeToMs = (timeStr) => {
  if (!timeStr) return null;
  const parts = timeStr.split(':').map(p => parseInt(p, 10));
  if (parts.some(isNaN)) return null;

  if (parts.length === 1) return parts[0] * 1000;
  if (parts.length === 2) return (parts[0] * 60 + parts[1]) * 1000;
  if (parts.length === 3) return (parts[0] * 3600 + parts[1] * 60 + parts[2]) * 1000;
  return null;
};

module.exports = {
  name: 'seek',
  description: 'Seek to a specific timestamp in the current track (e.g. *seek 1:30 or *seek 90)',
  category: 'music',
  cooldown: 2,
  async execute({ message, args, client, prefix }) {
    const gEmoji = (key) => { const e = getEmoji(key, client); return e ? `${e} ` : ''; };
    const player = client.lavalink?.players.get(message.guild.id);
    if (!player || !player.connected || !player.queue.current) {
      const embed = new EmbedBuilder()
        .setTitle(`${gEmoji('error')}Playback Error`)
        .setDescription('No track is currently playing.')
        .setColor(0xED4245);
      return sendAutoDelete(message.reply({ embeds: [embed] }), 6000);
    }

    if (!message.member.voice.channel || message.member.voice.channel.id !== player.voiceChannelId) {
      const embed = new EmbedBuilder()
        .setTitle(`${gEmoji('error')}Voice Channel Mismatch`)
        .setDescription('You must be in the same voice channel as the bot to seek!')
        .setColor(0xED4245);
      return sendAutoDelete(message.reply({ embeds: [embed] }), 6000);
    }

    if (!args[0]) {
      const embed = new EmbedBuilder()
        .setTitle(`${gEmoji('error')}Missing Argument`)
        .setDescription(`Please specify a timestamp.\n\n**Example:** \`${prefix}seek 1:30\` or \`${prefix}seek 90\``)
        .setColor(0xED4245);
      return sendAutoDelete(message.reply({ embeds: [embed] }), 6000);
    }

    const seekMs = parseTimeToMs(args[0]);
    if (seekMs === null || seekMs < 0 || seekMs > (player.queue.current.info.duration || Infinity)) {
      const embed = new EmbedBuilder()
        .setTitle(`${gEmoji('error')}Invalid Timestamp`)
        .setDescription('Invalid timestamp or position is out of track bounds.')
        .setColor(0xED4245);
      return sendAutoDelete(message.reply({ embeds: [embed] }), 6000);
    }

    await player.seek(seekMs);
    SessionPersistence.updatePosition(player.guildId, seekMs);
    SessionPersistence.saveSnapshot(player, true);

    const formatted = formatDuration(seekMs);

    const embed = new EmbedBuilder()
      .setTitle(`${gEmoji('seeked')}Seeked`)
      .setDescription(`Seeked to **${formatted}** in the current track.`)
      .setColor(0x5865F2);
    return sendAutoDelete(message.reply({ embeds: [embed] }), 10000);
  },
};
