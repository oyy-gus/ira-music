const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { sendAutoDelete } = require('../../utils/channelUtils');
const { getEmoji } = require('../../config/emojis');
const { formatTrackTitle } = require('../../utils/titleUtils');
const { formatDuration, createProgressBar } = require('../../utils/timeUtils');

module.exports = {
  name: 'nowplaying',
  description: 'Display currently playing track with interactive media controls',
  aliases: ['np'],
  category: 'music',
  cooldown: 2,
  async execute({ message, client }) {
    const player = client.lavalink?.players.get(message.guild.id);
    if (!player || !player.connected || !player.queue.current) {
      const embed = new EmbedBuilder()
        .setTitle(`${getEmoji('error', client)} Playback Error`)
        .setDescription('No track is currently playing.')
        .setColor(0xED4245);
      return sendAutoDelete(message.reply({ embeds: [embed] }), 6000);
    }

    const current = player.queue.current;
    const position = player.position || 0;
    const duration = current.info.duration || 0;

    const emoji = (key) => {
      const e = getEmoji(key, client);
      return e ? `${e} ` : '';
    };

    const cleanTitle = formatTrackTitle(current.info.title, 55);
    const embed = new EmbedBuilder()
      .setTitle(`${emoji('now_playing')}Now Playing`)
      .setDescription(`[**${cleanTitle}**](${current.info.uri})\nBy **${current.info.author}**`)
      .addFields(
        {
          name: `${emoji('duration')}Progress`,
          value: `\`${formatDuration(position, { isStream: current.info.isStream })}\` ${createProgressBar(position, duration, { filledChar: '▬', headChar: '⚪', unfilledChar: '▬' })} \`${formatDuration(duration, { isStream: current.info.isStream })}\``,
        },
        { name: `${emoji('disc')}Source`, value: `\`${(current.info.sourceName || 'AUDIO').toUpperCase()}\``, inline: true },
        { name: `${emoji('playback_volume')}Volume`, value: `\`${player.volume}%\``, inline: true },
        { name: `${emoji('queue')}Queue`, value: `\`${player.queue.tracks.length} tracks\``, inline: true }
      )
      .setColor(0x5865F2)
      .setFooter({ text: `Requested by ${current.userData?.requesterTag || 'Unknown'}` });

    const pauseEmoji = getEmoji('pause', client);
    const skipEmoji = getEmoji('skip', client);
    const shuffleEmoji = getEmoji('shuffle', client);
    const stopEmoji = getEmoji('stop', client);

    const btnPause = new ButtonBuilder().setCustomId('music_pause').setStyle(ButtonStyle.Secondary);
    if (pauseEmoji) btnPause.setEmoji(pauseEmoji); else btnPause.setLabel('Pause');

    const btnSkip = new ButtonBuilder().setCustomId('music_skip').setStyle(ButtonStyle.Secondary);
    if (skipEmoji) btnSkip.setEmoji(skipEmoji); else btnSkip.setLabel('Skip');

    const btnShuffle = new ButtonBuilder().setCustomId('music_shuffle').setStyle(ButtonStyle.Secondary);
    if (shuffleEmoji) btnShuffle.setEmoji(shuffleEmoji); else btnShuffle.setLabel('Shuffle');

    const btnStop = new ButtonBuilder().setCustomId('music_stop').setStyle(ButtonStyle.Danger);
    if (stopEmoji) btnStop.setEmoji(stopEmoji); else btnStop.setLabel('Stop');

    const row = new ActionRowBuilder().addComponents(btnPause, btnSkip, btnShuffle, btnStop);

    const replyMsg = await message.reply({ embeds: [embed], components: [row] });

    // Automatically disable control buttons when inactive (idle 2 mins)
    const collector = replyMsg.createMessageComponentCollector({ idle: 120000 });
    collector.on('end', () => {
      const disabledRow = new ActionRowBuilder().addComponents(
        row.components.map((b) => ButtonBuilder.from(b).setDisabled(true))
      );
      replyMsg.edit({ components: [disabledRow] }).catch(() => {});
    });

    return replyMsg;
  },
};
