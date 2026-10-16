const { AttachmentBuilder, EmbedBuilder } = require('discord.js');
const userRepo = require('../../database/repositories/userRepository');
const LeaderboardService = require('../../services/leaderboardService');
const { generateLevelCard } = require('../../utils/levelCanvas');
const { getEmoji } = require('../../config/emojis');
const { calculateProgression } = require('../../services/xpService');
const { sendAutoDelete } = require('../../utils/channelUtils');

module.exports = {
  name: 'level',
  description: 'View your player level, XP progress bar, and rank card with Canvas',
  aliases: ['lvl', 'rank', 'rankcard', 'xp'],
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
        .setTitle(`${gEmoji('error')}Bot Level`)
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
        .setDescription(`**${displayName}**'s level & statistics are set to **Private**.`)
        .setColor(0xFEE75C);
      return sendAutoDelete(message.reply({ embeds: [embed] }), 8000);
    }

    try {
      const { globalRank, serverRank } = await LeaderboardService.getUserRanks(userId, guildId);

      const buffer = await generateLevelCard(target, userDoc, {
        globalRank,
        serverRank,
      });

      const attachment = new AttachmentBuilder(buffer, { name: `level-${userId}.png` });

      return message.reply({ files: [attachment] });
    } catch (err) {
      const displayName = target?.nickname || target?.displayName || targetUser.username;
      const prog = calculateProgression(userDoc?.xp || 0);

      const embed = new EmbedBuilder()
        .setTitle(`⭐ Level — ${displayName}`)
        .addFields(
          { name: 'Current Level', value: `Level **${prog.level}**`, inline: true },
          { name: 'XP Progress', value: `${prog.currentXP} / ${prog.requiredXP} XP (${prog.progressPercent}%)`, inline: true },
          { name: 'XP to Next Level', value: `${prog.xpToNextLevel} XP`, inline: true }
        )
        .setColor(0x57F287);
      return message.reply({ embeds: [embed] });
    }
  },
};
