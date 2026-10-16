const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } = require('discord.js');
const { sendAutoDelete } = require('../../utils/channelUtils');
const { getEmoji } = require('../../config/emojis');
const { formatTrackTitle } = require('../../utils/titleUtils');
const { formatDuration, formatDurationText } = require('../../utils/timeUtils');

const PAGE_SIZE = 8;

function buildQueueEmbed(player, initialPage = 1, client = null) {
  const current = player?.queue?.current;
  const tracks = player?.queue?.tracks || [];
  const totalTracks = tracks.length;
  const totalPages = Math.max(1, Math.ceil(totalTracks / PAGE_SIZE));
  const currentPage = Math.min(Math.max(initialPage, 1), totalPages);

  const start = (currentPage - 1) * PAGE_SIZE;
  const pageTracks = tracks.slice(start, start + PAGE_SIZE);

  const qEmoji = getEmoji('queue', client);
  const npEmoji = getEmoji('now_playing', client);
  const streamEmoji = getEmoji('live_stream', client);

  const embed = new EmbedBuilder()
    .setTitle(`${qEmoji ? `${qEmoji} ` : ''}Server Music Queue (Page ${currentPage}/${totalPages})`)
    .setColor(0x5865F2);

  if (current) {
    const cleanTitle = formatTrackTitle(current.info?.title, 55);
    const cleanAuthor = (current.info?.author || 'Unknown Artist').slice(0, 30);
    const uri = current.info?.uri || '';
    const dur = current.info?.isStream
      ? `${streamEmoji ? `${streamEmoji} ` : ''}Live Stream`
      : formatDuration(current.info?.duration || 0);

    embed.addFields({
      name: `${npEmoji ? `${npEmoji} ` : ''}Now Playing`,
      value: `[**${cleanTitle}**](${uri}) — \`${cleanAuthor}\` | \`${dur}\``,
    });
  }

  if (pageTracks.length > 0) {
    const trackLines = pageTracks.map((t, idx) => {
      const title = formatTrackTitle(t.info?.title, 45);
      const author = (t.info?.author || 'Unknown Artist').slice(0, 25);
      const uri = t.info?.uri || '';
      const dur = t.info?.isStream
        ? 'Live'
        : formatDuration(t.info?.duration || 0);
      return `\`${start + idx + 1}.\` [${title}](${uri}) | \`${dur}\` — \`${author}\``;
    });

    let trackListStr = trackLines.join('\n');
    if (trackListStr.length > 1020) {
      trackListStr = trackListStr.slice(0, 1017) + '...';
    }

    embed.addFields({
      name: `Up Next (${start + 1}-${start + pageTracks.length} of ${totalTracks})`,
      value: trackListStr,
    });
  } else {
    embed.addFields({ name: 'Up Next', value: 'No upcoming tracks in queue.' });
  }

  let totalDurationMs = tracks.reduce((acc, t) => acc + (t.info?.duration || 0), 0);
  if (current && current.info?.duration) totalDurationMs += current.info.duration;
  const totalDurStr = formatDurationText(totalDurationMs);

  embed.setFooter({
    text: `Total Tracks: ${totalTracks} | Total Duration: ${totalDurStr} | Page ${currentPage}/${totalPages}`,
  });

  return { embed, totalPages, currentPage };
}

function buildQueueButtons(currentPage, totalPages, authorId, client = null) {
  const firstEmoji = getEmoji('first', client);
  const prevEmoji = getEmoji('prev', client);
  const stopEmoji = getEmoji('stop', client);
  const nextEmoji = getEmoji('next', client);
  const lastEmoji = getEmoji('last', client);

  const btnFirst = new ButtonBuilder()
    .setCustomId(`q_first_${authorId}_${currentPage}`)
    .setStyle(ButtonStyle.Secondary)
    .setDisabled(currentPage <= 1);
  if (firstEmoji) btnFirst.setEmoji(firstEmoji); else btnFirst.setLabel('First');

  const btnPrev = new ButtonBuilder()
    .setCustomId(`q_prev_${authorId}_${currentPage}`)
    .setStyle(ButtonStyle.Primary)
    .setDisabled(currentPage <= 1);
  if (prevEmoji) btnPrev.setEmoji(prevEmoji); else btnPrev.setLabel('Prev');

  const btnStop = new ButtonBuilder()
    .setCustomId(`q_stop_${authorId}_${currentPage}`)
    .setStyle(ButtonStyle.Danger);
  if (stopEmoji) btnStop.setEmoji(stopEmoji); else btnStop.setLabel('Stop');

  const btnNext = new ButtonBuilder()
    .setCustomId(`q_next_${authorId}_${currentPage}`)
    .setStyle(ButtonStyle.Primary)
    .setDisabled(currentPage >= totalPages);
  if (nextEmoji) btnNext.setEmoji(nextEmoji); else btnNext.setLabel('Next');

  const btnLast = new ButtonBuilder()
    .setCustomId(`q_last_${authorId}_${currentPage}`)
    .setStyle(ButtonStyle.Secondary)
    .setDisabled(currentPage >= totalPages);
  if (lastEmoji) btnLast.setEmoji(lastEmoji); else btnLast.setLabel('Last');

  return new ActionRowBuilder().addComponents(btnFirst, btnPrev, btnStop, btnNext, btnLast);
}

async function handleQueueButton(interaction, client) {
  const { customId, guildId, user } = interaction;
  const parts = customId.split('_');
  if (parts.length < 4 || parts[0] !== 'q') return;

  const action = parts[1];
  const authorId = parts[2];
  let currentPage = parseInt(parts[3], 10) || 1;

  // Defer update immediately to prevent Discord interaction timeout (3s limit)
  await interaction.deferUpdate().catch(() => {});

  if (authorId && user.id !== authorId) {
    const gEmoji = (key) => { const e = getEmoji(key, client); return e ? `${e} ` : ''; };
    return interaction.followUp({
      content: `${gEmoji('error')}Only the user who ran the command can use these queue pagination buttons.`,
      flags: MessageFlags.Ephemeral,
    }).catch(() => {});
  }

  if (action === 'stop') {
    const row = buildQueueButtons(currentPage, 1, authorId, client);
    const disabledRow = new ActionRowBuilder().addComponents(
      row.components.map((b) => ButtonBuilder.from(b).setDisabled(true))
    );
    return interaction.editReply({ components: [disabledRow] }).catch(() => {});
  }

  const player = client.lavalink?.players.get(guildId);
  if (!player || !player.connected) {
    const gEmoji = (key) => { const e = getEmoji(key, client); return e ? `${e} ` : ''; };
    const embed = new EmbedBuilder()
      .setTitle(`${gEmoji('error')}Session Ended`)
      .setDescription('No active music session in this server.')
      .setColor(0xED4245);
    const row = buildQueueButtons(currentPage, 1, authorId, client);
    const disabledRow = new ActionRowBuilder().addComponents(
      row.components.map((b) => ButtonBuilder.from(b).setDisabled(true))
    );
    return interaction.editReply({ embeds: [embed], components: [disabledRow] }).catch(() => {});
  }

  if (action === 'first') {
    currentPage = 1;
  } else if (action === 'prev') {
    currentPage = Math.max(1, currentPage - 1);
  } else if (action === 'next') {
    currentPage = currentPage + 1;
  } else if (action === 'last') {
    currentPage = 999999;
  }

  const { embed, totalPages, currentPage: newPage } = buildQueueEmbed(player, currentPage, client);
  const row = buildQueueButtons(newPage, totalPages, authorId, client);

  await interaction.editReply({ embeds: [embed], components: [row] }).catch(() => {});
}

module.exports = {
  name: 'queue',
  description: 'Manage audio queue (*queue, *queue remove, *queue clear, *queue shuffle, *queue move)',
  aliases: ['q'],
  category: 'music',
  cooldown: 2,
  buildQueueEmbed,
  buildQueueButtons,
  handleQueueButton,
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

    const subCommand = args[0] ? args[0].toLowerCase() : null;

    if (subCommand === 'clear') {
      player.queue.tracks.splice(0, player.queue.tracks.length);
      const embed = new EmbedBuilder()
        .setTitle(`${gEmoji('clear')}Queue Cleared`)
        .setDescription('All upcoming tracks have been removed from the queue.')
        .setColor(0x5865F2);
      return message.reply({ embeds: [embed] });
    }

    if (subCommand === 'shuffle') {
      player.queue.shuffle();
      const embed = new EmbedBuilder()
        .setTitle(`${gEmoji('shuffle')}Queue Shuffled`)
        .setDescription('Queue track order has been randomized.')
        .setColor(0x5865F2);
      return message.reply({ embeds: [embed] });
    }

    if (subCommand === 'remove') {
      const index = parseInt(args[1], 10);
      if (isNaN(index) || index < 1 || index > player.queue.tracks.length) {
        const embed = new EmbedBuilder()
          .setTitle(`${gEmoji('error')}Invalid Index`)
          .setDescription(`Usage: \`${prefix}queue remove <1-${player.queue.tracks.length || 1}>\``)
          .setColor(0xED4245);
        return sendAutoDelete(message.reply({ embeds: [embed] }), 6000);
      }
      const removed = player.queue.tracks.splice(index - 1, 1)[0];
      const cleanTitle = formatTrackTitle(removed.info.title, 50);
      const embed = new EmbedBuilder()
        .setTitle(`${gEmoji('trash')}Track Removed`)
        .setDescription(`Removed **${cleanTitle}** from queue.`)
        .setColor(0x5865F2);
      return message.reply({ embeds: [embed] });
    }

    if (subCommand === 'move') {
      const from = parseInt(args[1], 10);
      const to = parseInt(args[2], 10);
      if (isNaN(from) || isNaN(to) || from < 1 || to < 1 || from > player.queue.tracks.length || to > player.queue.tracks.length) {
        const embed = new EmbedBuilder()
          .setTitle(`${gEmoji('error')}Invalid Indices`)
          .setDescription(`Usage: \`${prefix}queue move <from> <to>\``)
          .setColor(0xED4245);
        return sendAutoDelete(message.reply({ embeds: [embed] }), 6000);
      }
      const item = player.queue.tracks.splice(from - 1, 1)[0];
      player.queue.tracks.splice(to - 1, 0, item);
      const cleanTitle = formatTrackTitle(item.info.title, 50);
      const embed = new EmbedBuilder()
        .setTitle(`${gEmoji('move_track')}Track Reordered`)
        .setDescription(`Moved **${cleanTitle}** from position \`#${from}\` to \`#${to}\`.`)
        .setColor(0x5865F2);
      return message.reply({ embeds: [embed] });
    }

    // Default view queue with pagination buttons
    const current = player.queue?.current;
    if (!current && (player.queue?.tracks?.length || 0) === 0) {
      const embed = new EmbedBuilder()
        .setTitle(`${gEmoji('queue')}Music Queue`)
        .setDescription('Queue is currently empty.')
        .setColor(0x5865F2);
      return message.reply({ embeds: [embed] });
    }

    const initialPage = parseInt(args[0], 10) || 1;
    let { embed, totalPages, currentPage } = buildQueueEmbed(player, initialPage, client);

    if (totalPages <= 1) {
      return message.reply({ embeds: [embed] });
    }

    const authorId = message.author?.id || message.user?.id || '';
    let row = buildQueueButtons(currentPage, totalPages, authorId, client);

    const replyMsg = await message.reply({ embeds: [embed], components: [row] });

    // Automatically disable pagination buttons when inactive (idle 2 mins)
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
