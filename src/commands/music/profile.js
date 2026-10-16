const { AttachmentBuilder, EmbedBuilder } = require('discord.js');
const userRepo = require('../../database/repositories/userRepository');
const LeaderboardService = require('../../services/leaderboardService');
const { AchievementEngine } = require('../../cloud/achievementEngine');
const { generateProfileCard } = require('../../utils/profileCanvas');
const { getEmoji } = require('../../config/emojis');
const { formatDurationText } = require('../../utils/timeUtils');
const { calculateProgression } = require('../../services/xpService');
const { sendAutoDelete } = require('../../utils/channelUtils');

module.exports = {
  name: 'profile',
  description: 'View identity, listening progression, level, XP, rank, badges & achievements card',
  aliases: ['userprofile', 'musicprofile', 'me'],
  category: 'utility',
  cooldown: 5,
  async execute({ message, client }) {
    const isMentioned = message.mentions?.users?.size > 0;
    const targetMember = message.mentions?.members?.first() || message.member;
    const targetUser = message.mentions?.users?.first() || message.author;
    const target = targetMember || targetUser;
    const userId = targetUser.id;
    const isSelf = userId === message.author.id;
    const guildId = message.guild?.id;

    const gEmoji = (key) => { const e = getEmoji(key, client); return e ? `${e} ` : ''; };

    // Bot check — bots do not gain XP or have level progression profiles
    if (targetUser.bot) {
      const embed = new EmbedBuilder()
        .setTitle(`${gEmoji('error')}Bot Profile`)
        .setDescription('🤖 **Bots do not gain XP or have level progression profiles!**\nXP and listening analytics only apply to human users.')
        .setColor(0xED4245);
      return sendAutoDelete(message.reply({ embeds: [embed] }), 8000);
    }

    const userDoc = await userRepo.getUser(userId);

    // Privacy check — block viewing other users' private profiles
    if (isMentioned && !isSelf && userDoc?.isPrivate) {
      const displayName = targetMember?.nickname || targetMember?.displayName || targetUser.username;
      const embed = new EmbedBuilder()
        .setTitle(`${gEmoji('lock')}Private Profile`)
        .setDescription(`**${displayName}**'s profile is set to **Private**.\nOnly they can view their own profile.`)
        .setColor(0xFEE75C);
      return sendAutoDelete(message.reply({ embeds: [embed] }), 8000);
    }

    try {
      const [{ globalRank, serverRank }, achievements] = await Promise.all([
        LeaderboardService.getUserRanks(userId, guildId),
        AchievementEngine.getUserAchievements(userId),
      ]);

      const buffer = await generateProfileCard(target, userDoc, {
        globalRank,
        serverRank,
        achievements,
      });

      const attachment = new AttachmentBuilder(buffer, { name: `profile-${userId}.png` });

      const extraContent = isSelf && userDoc?.isPrivate
        ? '🔒 Your profile is **Private**. Use `setprivacy public` to make it visible to others.'
        : undefined;

      return message.reply({ files: [attachment], content: extraContent });
    } catch (err) {
      const displayName = target?.nickname || target?.displayName || targetUser.username;
      const prog = calculateProgression(userDoc?.xp || 0);
      const totalSec = userDoc?.statistics?.timeListenedSeconds || 0;

      const embed = new EmbedBuilder()
        .setTitle(`${gEmoji('profile')}Profile — ${displayName}`)
        .setDescription(`**About Me:** ${userDoc?.aboutMe || 'Music Enthusiast 🎧'}`)
        .addFields(
          { name: 'Level & XP', value: `Level **${prog.level}** (${prog.currentXP} / ${prog.requiredXP} XP)`, inline: true },
          { name: 'Listening Time', value: formatDurationText(totalSec, { isSeconds: true }), inline: true },
          { name: 'Tracks Played', value: `${userDoc?.statistics?.songsPlayed || 0} tracks`, inline: true },
          { name: 'Privacy', value: userDoc?.isPrivate ? '🔒 Private' : '🌐 Public', inline: true }
        )
        .setColor(0x5865F2);
      return message.reply({ embeds: [embed] });
    }
  },
};
