const { EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder } = require('discord.js');
const TrackResolver = require('../../music/resolver/TrackResolver');
const { sendAutoDelete } = require('../../utils/channelUtils');
const { getEmoji } = require('../../config/emojis');
const { formatTrackTitle } = require('../../utils/titleUtils');
const { formatDuration } = require('../../utils/timeUtils');

module.exports = {
  name: 'search',
  description: 'Search for music tracks and select from results',
  aliases: ['find'],
  category: 'music',
  cooldown: 3,
  async execute({ message, args, rawArgsString, client, prefix }) {
    const gEmoji = (key) => { const e = getEmoji(key, client); return e ? `${e} ` : ''; };
    if (!rawArgsString) {
      const embed = new EmbedBuilder()
        .setTitle(`${gEmoji('error')}Missing Search Query`)
        .setDescription(`Please provide a search term.\n\n**Example:** \`${prefix}search Imagine Dragons Believer\``)
        .setColor(0xED4245);
      return sendAutoDelete(message.reply({ embeds: [embed] }), 6000);
    }

    const voiceChannel = message.member.voice.channel;
    if (!voiceChannel) {
      const embed = new EmbedBuilder()
        .setTitle(`${gEmoji('error')}Voice Channel Required`)
        .setDescription('You must be connected to a voice channel to search and play music!')
        .setColor(0xED4245);
      return sendAutoDelete(message.reply({ embeds: [embed] }), 6000);
    }

    let player = client.lavalink.players.get(message.guild.id);
    if (!player) {
      player = client.lavalink.createPlayer({
        guildId: message.guild.id,
        voiceChannelId: voiceChannel.id,
        textChannelId: message.channel.id,
        selfDeaf: true,
        selfMute: false,
        volume: 100,
      });
    } else {
      player.textChannelId = message.channel.id;
    }

    if (!player.connected) {
      await player.connect();
    }

    const searchEmbed = new EmbedBuilder()
      .setTitle(`${gEmoji('search')}Searching Tracks`)
      .setDescription(`Searching YouTube for \`${rawArgsString}\`...`)
      .setColor(0x5865F2);

    const replyMsg = await message.reply({ embeds: [searchEmbed] });

    try {
      const result = await TrackResolver.resolve(player, rawArgsString, message.author);
      if (!result.tracks || result.tracks.length === 0) {
        const embed = new EmbedBuilder()
          .setTitle(`${gEmoji('error')}No Results Found`)
          .setDescription(`No tracks found for \`${rawArgsString}\`.`)
          .setColor(0xED4245);
        await replyMsg.edit({ embeds: [embed] });
        return sendAutoDelete(replyMsg, 6000);
      }

      const topTracks = result.tracks.slice(0, 5);

      const descriptionLines = topTracks.map((t, index) => {
        const dur = formatDuration(t.info.duration, { isStream: t.info.isStream });
        const cleanTitle = formatTrackTitle(t.info.title, 50);
        return `**${index + 1}.** [${cleanTitle}](${t.info.uri || ''}) \`[${dur}]\``;
      }).join('\n');

      const selectMenu = new StringSelectMenuBuilder()
        .setCustomId(`search_select_${message.author.id}_${Date.now()}`)
        .setPlaceholder('Select a track to play...')
        .addOptions(
          topTracks.map((t, index) => ({
            label: `${index + 1}. ${formatTrackTitle(t.info.title, 85)}`,
            description: `By ${(t.info.author || 'Unknown').substring(0, 45)}`,
            value: index.toString(),
          }))
        );

      const row = new ActionRowBuilder().addComponents(selectMenu);

      const resultsEmbed = new EmbedBuilder()
        .setTitle(`${gEmoji('search')}Search Results`)
        .setDescription(`Top results for \`${rawArgsString}\`:\n\n${descriptionLines}\n\n*Select a track from the dropdown below within 30 seconds.*`)
        .setColor(0x5865F2);

      await replyMsg.edit({ embeds: [resultsEmbed], components: [row] });

      const filter = (i) => i.customId.startsWith('search_select_') && i.user.id === message.author.id;
      const collector = replyMsg.createMessageComponentCollector({ filter, time: 30000, max: 1 });

      collector.on('collect', async (interaction) => {
        const selectedIndex = parseInt(interaction.values[0], 10);
        const selectedTrack = topTracks[selectedIndex];

        player.queue.add(selectedTrack);

        const cleanSelTitle = formatTrackTitle(selectedTrack.info.title, 50);
        const addedEmbed = new EmbedBuilder()
          .setTitle(`${gEmoji('music')}Track Selected`)
          .setDescription(`Added **[${cleanSelTitle}](${selectedTrack.info.uri || ''})** to queue.`)
          .setColor(0x57F287);

        await interaction.update({ embeds: [addedEmbed], components: [] });
        sendAutoDelete(replyMsg, 15000);

        if (!player.playing && !player.paused) {
          await player.play();
        }
      });

      collector.on('end', (collected, reason) => {
        if (reason === 'time' && collected.size === 0) {
          const timeoutEmbed = new EmbedBuilder()
            .setTitle(`${gEmoji('error')}Search Timed Out`)
            .setDescription('No track was selected within 30 seconds.')
            .setColor(0xED4245);
          replyMsg.edit({ embeds: [timeoutEmbed], components: [] }).catch(() => {});
          sendAutoDelete(replyMsg, 6000);
        }
      });
    } catch (err) {
      const embed = new EmbedBuilder()
        .setTitle(`${gEmoji('error')}Search Failed`)
        .setDescription(`An error occurred while searching: ${err.message}`)
        .setColor(0xED4245);
      await replyMsg.edit({ embeds: [embed] }).catch(() => {});
      return sendAutoDelete(replyMsg, 6000);
    }
  },
};
