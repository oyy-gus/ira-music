const { EmbedBuilder } = require('discord.js');
const playlistRepo = require('../../database/repositories/playlistRepository');
const TrackResolver = require('../../music/resolver/TrackResolver');
const SessionPersistence = require('../../music/failover/SessionPersistence');
const { sendAutoDelete } = require('../../utils/channelUtils');
const { getEmoji } = require('../../config/emojis');

module.exports = {
  name: 'playlist',
  description: 'Manage personal custom playlists (*playlist create/list/play/view/add/remove/delete)',
  aliases: ['pl'],
  category: 'playlist',
  cooldown: 3,
  async execute({ message, args, client, prefix }) {
    const gEmoji = (key) => { const e = getEmoji(key, client); return e ? `${e} ` : ''; };
    const subCommand = args[0] ? args[0].toLowerCase() : null;

    if (!subCommand || subCommand === 'list') {
      const playlists = await playlistRepo.getUserPlaylists(message.author.id);
      if (playlists.length === 0) {
        const embed = new EmbedBuilder()
          .setTitle(`${gEmoji('playlist')}No Playlists`)
          .setDescription(`You have no saved playlists.\nCreate one with \`${prefix}playlist create <name>\``)
          .setColor(0xFEE75C);
        return sendAutoDelete(message.reply({ embeds: [embed] }), 15000);
      }

      const list = playlists.map(p => `• **${p.name}** (${p.tracks.length} tracks)`).join('\n');
      const embed = new EmbedBuilder()
        .setTitle(`${gEmoji('playlist_save')}Your Saved Playlists (${playlists.length})`)
        .setDescription(list)
        .setColor(0x5865F2);
      return sendAutoDelete(message.reply({ embeds: [embed] }), 15000);
    }

    if (subCommand === 'create') {
      const name = args[1];
      if (!name) {
        const embed = new EmbedBuilder()
          .setTitle(`${gEmoji('error')}Missing Argument`)
          .setDescription(`Usage: \`${prefix}playlist create <name>\``)
          .setColor(0xED4245);
        return sendAutoDelete(message.reply({ embeds: [embed] }), 6000);
      }
      try {
        await playlistRepo.createPlaylist(message.author.id, name);
        const embed = new EmbedBuilder()
          .setTitle(`${gEmoji('success')}Playlist Created`)
          .setDescription(`Playlist **${name}** created successfully!`)
          .setColor(0x57F287);
        return sendAutoDelete(message.reply({ embeds: [embed] }), 12000);
      } catch (err) {
        const embed = new EmbedBuilder()
          .setTitle(`${gEmoji('error')}Creation Failed`)
          .setDescription(err.message)
          .setColor(0xED4245);
        return sendAutoDelete(message.reply({ embeds: [embed] }), 6000);
      }
    }

    if (subCommand === 'delete') {
      const name = args[1];
      if (!name) {
        const embed = new EmbedBuilder()
          .setTitle(`${gEmoji('error')}Missing Argument`)
          .setDescription(`Usage: \`${prefix}playlist delete <name>\``)
          .setColor(0xED4245);
        return sendAutoDelete(message.reply({ embeds: [embed] }), 6000);
      }
      const deleted = await playlistRepo.deletePlaylist(message.author.id, name);
      if (deleted) {
        const embed = new EmbedBuilder()
          .setTitle(`${gEmoji('playlist_delete')}Playlist Deleted`)
          .setDescription(`Playlist **${name}** has been deleted.`)
          .setColor(0x5865F2);
        return sendAutoDelete(message.reply({ embeds: [embed] }), 12000);
      }
      const embed = new EmbedBuilder()
        .setTitle(`${gEmoji('error')}Not Found`)
        .setDescription(`Playlist **${name}** not found.`)
        .setColor(0xED4245);
      return sendAutoDelete(message.reply({ embeds: [embed] }), 6000);
    }

    if (subCommand === 'add') {
      const name = args[1];
      const songQuery = args.slice(2).join(' ');
      if (!name || !songQuery) {
        const embed = new EmbedBuilder()
          .setTitle(`${gEmoji('error')}Missing Arguments`)
          .setDescription(`Usage: \`${prefix}playlist add <name> <song url/name>\``)
          .setColor(0xED4245);
        return sendAutoDelete(message.reply({ embeds: [embed] }), 6000);
      }

      const playlist = await playlistRepo.getPlaylistByName(message.author.id, name);
      if (!playlist) {
        const embed = new EmbedBuilder()
          .setTitle(`${gEmoji('error')}Not Found`)
          .setDescription(`Playlist **${name}** not found.`)
          .setColor(0xED4245);
        return sendAutoDelete(message.reply({ embeds: [embed] }), 6000);
      }

      // Use a node directly for search when no player exists
      let searchTarget = client.lavalink?.players.get(message.guild.id);
      if (!searchTarget) {
        searchTarget = client.lavalink?.nodeManager?.nodes?.values()?.next()?.value;
      }

      const result = await TrackResolver.resolve(searchTarget || client.lavalink, songQuery, message.author);
      const track = result.tracks[0];

      await playlistRepo.addTrackToPlaylist(playlist._id, {
        title: track.info.title,
        author: track.info.author,
        uri: track.info.uri,
        identifier: track.info.identifier,
        duration: track.info.duration,
        sourceName: track.info.sourceName,
        addedBy: message.author.id,
      });

      const embed = new EmbedBuilder()
        .setTitle(`${gEmoji('success')}Track Added to Playlist`)
        .setDescription(`Added **${track.info.title}** to playlist **${name}**.`)
        .setColor(0x57F287);
      return sendAutoDelete(message.reply({ embeds: [embed] }), 12000);
    }

    if (subCommand === 'view') {
      const name = args[1];
      if (!name) {
        const embed = new EmbedBuilder()
          .setTitle(`${gEmoji('error')}Missing Argument`)
          .setDescription(`Usage: \`${prefix}playlist view <name>\``)
          .setColor(0xED4245);
        return sendAutoDelete(message.reply({ embeds: [embed] }), 6000);
      }

      const playlist = await playlistRepo.getPlaylistByName(message.author.id, name);
      if (!playlist) {
        const embed = new EmbedBuilder()
          .setTitle(`${gEmoji('error')}Not Found`)
          .setDescription(`Playlist **${name}** not found.`)
          .setColor(0xED4245);
        return sendAutoDelete(message.reply({ embeds: [embed] }), 6000);
      }

      if (playlist.tracks.length === 0) {
        const embed = new EmbedBuilder()
          .setTitle(`${gEmoji('playlist')}Playlist: ${playlist.name}`)
          .setDescription('This playlist is currently empty.')
          .setColor(0xFEE75C);
        return sendAutoDelete(message.reply({ embeds: [embed] }), 15000);
      }

      const trackList = playlist.tracks
        .slice(0, 15)
        .map((t, i) => `\`${i + 1}.\` [${t.title}](${t.uri}) — \`${t.author}\``)
        .join('\n');

      const embed = new EmbedBuilder()
        .setTitle(`${gEmoji('playlist')}Playlist: ${playlist.name}`)
        .setDescription(trackList)
        .setFooter({ text: `Total Tracks: ${playlist.tracks.length}` })
        .setColor(0x5865F2);
      return sendAutoDelete(message.reply({ embeds: [embed] }), 15000);
    }

    if (subCommand === 'play') {
      const name = args[1];
      if (!name) {
        const embed = new EmbedBuilder()
          .setTitle(`${gEmoji('error')}Missing Argument`)
          .setDescription(`Usage: \`${prefix}playlist play <name>\``)
          .setColor(0xED4245);
        return sendAutoDelete(message.reply({ embeds: [embed] }), 6000);
      }

      const voiceChannel = message.member.voice.channel;
      if (!voiceChannel) {
        const embed = new EmbedBuilder()
          .setTitle(`${gEmoji('error')}Voice Channel Required`)
          .setDescription('You must be in a voice channel!')
          .setColor(0xED4245);
        return sendAutoDelete(message.reply({ embeds: [embed] }), 6000);
      }

      const playlist = await playlistRepo.getPlaylistByName(message.author.id, name);
      if (!playlist || playlist.tracks.length === 0) {
        const embed = new EmbedBuilder()
          .setTitle(`${gEmoji('error')}Playlist Error`)
          .setDescription(`Playlist **${name}** not found or is empty.`)
          .setColor(0xED4245);
        return sendAutoDelete(message.reply({ embeds: [embed] }), 6000);
      }

      let player = client.lavalink.players.get(message.guild.id);
      if (!player) {
        player = client.lavalink.createPlayer({
          guildId: message.guild.id,
          voiceChannelId: voiceChannel.id,
          textChannelId: message.channel.id,
        });
      }

      if (!player.connected) await player.connect();

      for (const trackData of playlist.tracks) {
        const res = await player.search({ query: trackData.uri }, message.author);
        if (res?.tracks?.length > 0) {
          res.tracks[0].userData = { requesterId: message.author.id, requesterTag: message.author.tag };
          player.queue.add(res.tracks[0]);
        }
      }

      if (!player.playing && !player.paused) await player.play();
      SessionPersistence.saveSnapshot(player, true);

      const embed = new EmbedBuilder()
        .setTitle(`${gEmoji('playlist')}Playing Playlist`)
        .setDescription(`Playing **${playlist.tracks.length} tracks** from playlist **${playlist.name}**!`)
        .setColor(0x57F287);
      return sendAutoDelete(message.reply({ embeds: [embed] }), 15000);
    }

    const embed = new EmbedBuilder()
      .setTitle(`${gEmoji('error')}Unknown Subcommand`)
      .setDescription(`Usage: \`${prefix}playlist <list/create/delete/add/view/play>\``)
      .setColor(0xED4245);
    return sendAutoDelete(message.reply({ embeds: [embed] }), 6000);
  },
};
