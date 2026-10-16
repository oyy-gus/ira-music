const { EmbedBuilder } = require('discord.js');
const TrackResolver = require('../../music/resolver/TrackResolver');
const CustomError = require('../../utils/CustomError');
const { PlayerMigrationManager } = require('../../music/failover/PlayerMigrationManager');
const SessionPersistence = require('../../music/failover/SessionPersistence');
const logger = require('../../logger/logger');
const { sendAutoDelete } = require('../../utils/channelUtils');
const { getEmoji } = require('../../config/emojis');
const { ensureStageSpeaker } = require('../../utils/stageUtils');

const { formatTrackTitle } = require('../../utils/titleUtils');
const { formatDuration } = require('../../utils/timeUtils');

module.exports = {
  name: 'play',
  description: 'Play a track or playlist from YouTube, SoundCloud, or URL',
  aliases: ['p'],
  category: 'music',
  cooldown: 2,
  async execute({ message, args, rawArgsString, client, prefix }) {
    const gEmoji = (key) => { const e = getEmoji(key, client); return e ? `${e} ` : ''; };
    if (!rawArgsString) {
      const embed = new EmbedBuilder()
        .setTitle(`${gEmoji('error')}Missing Argument`)
        .setDescription(`Please provide a song title or URL.\n\n**Example:** \`${prefix}play Alan Walker Faded\``)
        .setColor(0xED4245);
      return sendAutoDelete(message.reply({ embeds: [embed] }), 6000);
    }

    const voiceChannel = message.member.voice.channel;
    if (!voiceChannel) {
      const embed = new EmbedBuilder()
        .setTitle(`${gEmoji('error')}Voice Channel Required`)
        .setDescription('You must be connected to a voice channel to play music!')
        .setColor(0xED4245);
      return sendAutoDelete(message.reply({ embeds: [embed] }), 6000);
    }

    const botPermissions = voiceChannel.permissionsFor(message.guild.members.me);
    if (!botPermissions.has('Connect') || !botPermissions.has('Speak')) {
      const embed = new EmbedBuilder()
        .setTitle(`${gEmoji('error')}Permission Denied`)
        .setDescription('I do not have permissions to join and speak in your voice channel!')
        .setColor(0xED4245);
      return sendAutoDelete(message.reply({ embeds: [embed] }), 6000);
    }

    if (!client.lavalink) {
      const embed = new EmbedBuilder()
        .setTitle(`${gEmoji('reconnect')}System Initializing`)
        .setDescription('Music engine is currently starting up. Please try again in a moment.')
        .setColor(0xFEE75C);
      return sendAutoDelete(message.reply({ embeds: [embed] }), 6000);
    }

    let player = client.lavalink.players.get(message.guild.id);

    if (!player) {
      const bestNode = PlayerMigrationManager.selectBestNode(client.lavalink);
      try {
        player = client.lavalink.createPlayer({
          guildId: message.guild.id,
          voiceChannelId: voiceChannel.id,
          textChannelId: message.channel.id,
          selfDeaf: true,
          selfMute: false,
          volume: 100,
          node: bestNode ? bestNode.id : undefined,
        });
      } catch (err) {
        logger.error(`[PlayCommand] Error creating player: ${err.message}`);
        const embed = new EmbedBuilder()
          .setTitle(`${gEmoji('reconnect')}Lavalink Node Connecting`)
          .setDescription('Lavalink node is currently reconnecting. Please try your command again in a few seconds.')
          .setColor(0xFEE75C);
        return sendAutoDelete(message.reply({ embeds: [embed] }), 6000);
      }
    } else {
      player.textChannelId = message.channel.id;
    }

    if (player.voiceChannelId !== voiceChannel.id) {
      const embed = new EmbedBuilder()
        .setTitle(`${gEmoji('error')}Voice Channel Mismatch`)
        .setDescription('You must be in the same voice channel as the bot!')
        .setColor(0xED4245);
      return sendAutoDelete(message.reply({ embeds: [embed] }), 6000);
    }

    if (!player.connected) {
      await player.connect();
    }
    ensureStageSpeaker(message.guild, voiceChannel.id).catch(() => {});

    const searchEmbed = new EmbedBuilder()
      .setTitle(`${gEmoji('search')}Searching Audio`)
      .setDescription(`Searching for \`${rawArgsString}\`...`)
      .setColor(0x5865F2);

    const replyMsg = await message.reply({ embeds: [searchEmbed] });

    try {
      const result = await TrackResolver.resolve(player, rawArgsString, message.author);

      if (result.type === 'PLAYLIST') {
        player.queue.add(result.tracks);
        SessionPersistence.saveSnapshot(player, true);
        const embed = new EmbedBuilder()
          .setTitle(`${gEmoji('playlist')}Playlist Added to Queue`)
          .setDescription(`Added **${result.tracks.length} tracks** from **${result.playlistName || 'Playlist'}**`)
          .setColor(0x57F287)
          .setFooter({ text: `Requested by ${message.author.tag}` });
        await replyMsg.edit({ embeds: [embed] });
        sendAutoDelete(replyMsg, 15000);
      } else {
        const track = result.tracks[0];
        player.queue.add(track);
        SessionPersistence.saveSnapshot(player, true);

        if (player.playing || player.paused) {
          const cleanTitle = formatTrackTitle(track.info.title, 50);
          const embed = new EmbedBuilder()
            .setTitle(`${gEmoji('music')}Track Added to Queue`)
            .setDescription(`[${cleanTitle}](${track.info.uri || ''}) — \`${track.info.author || 'Unknown'}\``)
            .addFields(
              { name: `${gEmoji('duration')}Duration`, value: `\`${formatDuration(track.info.duration, { isStream: track.info.isStream })}\``, inline: true },
              { name: `${gEmoji('queue')}Queue Position`, value: `\`#${player.queue.tracks.length}\``, inline: true }
            )
            .setColor(0x57F287);
          await replyMsg.edit({ embeds: [embed] });
          sendAutoDelete(replyMsg, 15000);
        } else {
          await replyMsg.delete().catch(() => {});
        }
      }

      if (!player.playing && !player.paused) {
        await player.play();
      }
    } catch (error) {
      await replyMsg.delete().catch(() => {});
      if (error instanceof CustomError) {
        const embed = new EmbedBuilder()
          .setTitle(`${gEmoji('error')}Search Failed`)
          .setDescription(error.userMessage)
          .setColor(0xFEE75C);
        return sendAutoDelete(message.reply({ embeds: [embed] }), 6000);
      }
      throw error;
    }
  },
};

