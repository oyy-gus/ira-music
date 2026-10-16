const { EmbedBuilder } = require('discord.js');
const { sendAutoDelete } = require('../../utils/channelUtils');
const { getEmoji } = require('../../config/emojis');
const { formatTrackTitle } = require('../../utils/titleUtils');

module.exports = {
  name: 'skip',
  description: 'Skip the current track',
  aliases: ['s', 'next'],
  category: 'music',
  cooldown: 2,
  async execute({ message, client }) {
    const gEmoji = (key) => { const e = getEmoji(key, client); return e ? `${e} ` : ''; };
    const player = client.lavalink?.players.get(message.guild.id);
    if (!player || !player.connected || !player.queue.current) {
      const embed = new EmbedBuilder()
        .setTitle(`${gEmoji('error')}Playback Error`)
        .setDescription('No track is currently playing in this server.')
        .setColor(0xED4245);
      return sendAutoDelete(message.reply({ embeds: [embed] }), 6000);
    }

    if (!message.member.voice.channel || message.member.voice.channel.id !== player.voiceChannelId) {
      const embed = new EmbedBuilder()
        .setTitle(`${gEmoji('error')}Channel Error`)
        .setDescription('You must be in the same voice channel as the bot to skip!')
        .setColor(0xED4245);
      return sendAutoDelete(message.reply({ embeds: [embed] }), 6000);
    }

    const currentTitle = formatTrackTitle(player.queue.current.info.title, 45);

    if (player.queue.tracks.length === 0) {
      await player.stopPlaying(false);
      const isAutoplay = player.get('autoplay');
      const embed = new EmbedBuilder()
        .setTitle(`${gEmoji('skip')}Track Skipped`)
        .setDescription(
          isAutoplay
            ? `Skipped **${currentTitle}**.\n${gEmoji('autoplay')}*Autoplay is searching for the next recommended track...*`
            : `Skipped **${currentTitle}**. Reached the end of the queue.`
        )
        .setColor(0x5865F2);
      return sendAutoDelete(message.reply({ embeds: [embed] }), 10000);
    } else {
      await player.skip();
      const nextTitle = formatTrackTitle(player.queue.tracks[0]?.info?.title || 'Next Track', 45);
      const embed = new EmbedBuilder()
        .setTitle(`${gEmoji('skip')}Track Skipped`)
        .setDescription(`Skipped **${currentTitle}**.\n${gEmoji('now_playing')} Now Playing: **${nextTitle}**`)
        .setColor(0x5865F2);
      return sendAutoDelete(message.reply({ embeds: [embed] }), 10000);
    }
  },
};
