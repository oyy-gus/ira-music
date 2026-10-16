const { EmbedBuilder } = require('discord.js');
const RecommendationEngine = require('../../music/autoplay/recommendationEngine');
const { sendAutoDelete } = require('../../utils/channelUtils');
const { getEmoji } = require('../../config/emojis');
const { formatDuration } = require('../../utils/timeUtils');

module.exports = {
  name: 'recommend',
  description: 'Get smart track recommendations based on current playing track',
  aliases: ['rec', 'suggest'],
  category: 'music',
  cooldown: 5,
  async execute({ message, client }) {
    const gEmoji = (key) => { const e = getEmoji(key, client); return e ? `${e} ` : ''; };
    const player = client.lavalink?.players.get(message.guild.id);
    if (!player || !player.connected || !player.queue.current) {
      const embed = new EmbedBuilder()
        .setTitle(`${gEmoji('error')}Playback Required`)
        .setDescription('Please play a track first so recommendation engine can analyze audio metadata!')
        .setColor(0xED4245);
      return sendAutoDelete(message.reply({ embeds: [embed] }), 6000);
    }

    const currentTrack = player.queue.current;
    const searchEmbed = new EmbedBuilder()
      .setTitle(`${gEmoji('analyzing')}Analyzing Music Intelligence...`)
      .setDescription(`Generating track recommendation based on **${currentTrack.info.title}**...`)
      .setColor(0x5865F2);

    const replyMsg = await message.reply({ embeds: [searchEmbed] });

    try {
      const recTrack = await RecommendationEngine.getRecommendation(player, currentTrack);
      if (!recTrack) {
        const embed = new EmbedBuilder()
          .setTitle(`${gEmoji('error')}Recommendation Failed`)
          .setDescription('Could not generate a track recommendation at this moment.')
          .setColor(0xED4245);
        await replyMsg.edit({ embeds: [embed] });
        return sendAutoDelete(replyMsg, 6000);
      }

      recTrack.userData = { requesterTag: message.author.tag, requesterId: message.author.id };
      player.queue.add(recTrack);

      const durStr = formatDuration(recTrack.info.duration || 0, { isStream: recTrack.info.isStream });

      const embed = new EmbedBuilder()
        .setTitle(`${gEmoji('smart_recommendation')} Smart Recommendation`)
        .setDescription(`Recommended based on **${currentTrack.info.author || currentTrack.info.title}**:\n\n` +
          `${gEmoji('music')} **[${recTrack.info.title}](${recTrack.info.uri || ''})**\n` +
          `${gEmoji('artist')} Artist: \`${recTrack.info.author || 'Unknown'}\`\n` +
          `${gEmoji('duration')} Duration: \`${durStr}\``
        )
        .setColor(0x57F287)
        .setFooter({ text: `Added to queue at position #${player.queue.tracks.length}` });

      await replyMsg.edit({ embeds: [embed] });
      return sendAutoDelete(replyMsg, 12000);
    } catch (err) {
      const embed = new EmbedBuilder()
        .setTitle(`${gEmoji('error')}Recommendation Error`)
        .setDescription(`Error: ${err.message}`)
        .setColor(0xED4245);
      await replyMsg.edit({ embeds: [embed] }).catch(() => {});
      return sendAutoDelete(replyMsg, 6000);
    }
  },
};

