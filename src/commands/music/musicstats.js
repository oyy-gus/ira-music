const { EmbedBuilder, AttachmentBuilder } = require('discord.js');
const userRepo = require('../../database/repositories/userRepository');
const { getEmoji } = require('../../config/emojis');
const { formatDurationText } = require('../../utils/timeUtils');
const { sendAutoDelete } = require('../../utils/channelUtils');
const { generateMusicStatsCard } = require('../../utils/musicStatsCanvas');

module.exports = {
  name: 'musicstats',
  description: 'View detailed music listening analytics, top songs, most played server & music companions with a Canvas card',
  aliases: ['statsmusic', 'mstats', 'musicanalytics'],
  category: 'utility',
  cooldown: 5,
  async execute({ message, client }) {
    const isMentioned = message.mentions?.users?.size > 0;
    const targetMember = message.mentions?.members?.first() || message.member;
    const targetUser = message.mentions?.users?.first() || message.author;
    const target = targetMember || targetUser;
    const userId = targetUser.id;
    const isSelf = userId === message.author.id;

    const gEmoji = (key) => { const e = getEmoji(key, client); return e ? `${e} ` : ''; };

    // Bot check — bots do not gain XP or have music analytics profiles
    if (targetUser.bot) {
      const embed = new EmbedBuilder()
        .setTitle(`${gEmoji('error')}Bot Analytics`)
        .setDescription('🤖 **Bots do not gain XP or have music statistics profiles!**\nXP and listening analytics only apply to human users.')
        .setColor(0xED4245);
      return sendAutoDelete(message.reply({ embeds: [embed] }), 8000);
    }

    const userDoc = await userRepo.getUser(userId);
    const displayName = target?.nickname || target?.displayName || targetUser.username;

    // Privacy check — block viewing other users' private profiles
    if (isMentioned && !isSelf && userDoc?.isPrivate) {
      const embed = new EmbedBuilder()
        .setTitle(`${gEmoji('lock')}Private Profile`)
        .setDescription(`**${displayName}**'s music statistics are set to **Private**.`)
        .setColor(0xFEE75C);
      return sendAutoDelete(message.reply({ embeds: [embed] }), 8000);
    }

    try {
      const cardBuffer = await generateMusicStatsCard(target, userDoc);
      const attachment = new AttachmentBuilder(cardBuffer, { name: `musicstats-${userId}.png` });
      return message.reply({ files: [attachment] });
    } catch (err) {
      // Fallback to text embed if Canvas fails for any reason
      const totalSec = userDoc?.statistics?.timeListenedSeconds || 0;
      const listenStr = formatDurationText(totalSec, { isSeconds: true });
      const tracksPlayed = userDoc?.statistics?.songsPlayed || 0;

      const topGuild = userDoc?.topGuilds?.[0];
      const topGuildText = topGuild ? `**${topGuild.guildName}** (${topGuild.playCount} sessions)` : 'None recorded yet';

      const topTracks = userDoc?.topTracks || [];
      const medals = [
        gEmoji('medal_1') || '🥇',
        gEmoji('medal_2') || '🥈',
        gEmoji('medal_3') || '🥉',
      ];
      const songsText = topTracks.length > 0
        ? topTracks.slice(0, 3).map((t, idx) => `${medals[idx]} **${t.title}**\n   *by ${t.author || 'Unknown'}* • \`${t.playCount || 1} plays\``).join('\n\n')
        : 'No track data recorded yet.';

      const topCompanions = userDoc?.topCompanions || [];
      const companionsText = topCompanions.length > 0
        ? topCompanions.slice(0, 3).map((c, idx) => `${medals[idx]} **@${c.username || 'User'}**\n   \`${c.listenCount || 1}x together\``).join('\n\n')
        : 'No companion data recorded yet.';

      const eAnalytics = gEmoji('music_stats') || gEmoji('analytics') || gEmoji('headphones') || '📊 ';
      const eOverview = gEmoji('headphones') || gEmoji('listening') || '🎧 ';
      const eServer = gEmoji('server') || gEmoji('home') || '🏠 ';
      const eSongs = gEmoji('top_tracks') || gEmoji('songs') || gEmoji('music_note') || '🎵 ';
      const ePeople = gEmoji('companions') || gEmoji('people') || gEmoji('user') || '👥 ';

      const embed = new EmbedBuilder()
        .setTitle(`${eAnalytics}MUSIC ANALYTICS — ${displayName}`)
        .setThumbnail(targetUser.displayAvatarURL({ extension: 'png', size: 128 }))
        .setColor(0xEB459E)
        .addFields(
          {
            name: `${eOverview}LISTENING OVERVIEW`,
            value: `• **Total Listening Time:** \`${listenStr}\`\n• **Total Tracks Played:** \`${tracksPlayed.toLocaleString()} tracks\``,
            inline: false,
          },
          {
            name: `${eServer}MOST PLAYED SERVER`,
            value: topGuildText,
            inline: false,
          },
          {
            name: `${eSongs}TOP 3 MOST PLAYED SONGS`,
            value: songsText,
            inline: false,
          },
          {
            name: `${ePeople}TOP 3 MUSIC COMPANIONS`,
            value: companionsText,
            inline: false,
          }
        )
        .setFooter({ text: `${client.user?.displayName || client.user?.username || 'Bot'} Analytics Engine`, iconURL: client.user?.displayAvatarURL() });

      return message.reply({ embeds: [embed] });
    }
  },
};
