const { EmbedBuilder } = require('discord.js');
const { AchievementEngine, ACHIEVEMENTS_REGISTRY } = require('../../cloud/achievementEngine');
const userRepo = require('../../database/repositories/userRepository');
const { getEmoji } = require('../../config/emojis');

module.exports = {
  name: 'achievements',
  description: 'View your unlocked and locked achievements collection',
  aliases: ['achievement', 'ach'],
  category: 'utility',
  cooldown: 5,
  async execute({ message, client }) {
    const targetUser = message.mentions?.users?.first() || message.author;
    const userId = targetUser.id;
    const displayName = targetUser.displayName || targetUser.username;

    const unlocked = await AchievementEngine.getUserAchievements(userId);
    const unlockedIds = new Set(unlocked.map((a) => a.achievementId));

    const e = (key, fallback) => getEmoji(key, fallback, client);
    const eSpace = (key, fallback) => {
      const val = e(key, fallback);
      return val ? `${val} ` : '';
    };

    const botName = client.user?.displayName || client.user?.username || 'Bot';

    const lines = ACHIEVEMENTS_REGISTRY.map((ach) => {
      const isUnlocked = unlockedIds.has(ach.id);
      const statusText = isUnlocked ? '`[UNLOCKED]`' : '`[LOCKED]`';
      const achIcon = e(ach.emojiKey || `achievement_${ach.id}`, ach.icon);
      return `${statusText} ${achIcon} **${ach.title}**\n   *${ach.description}*`;
    });

    const titleEmoji = eSpace('achievement', '🎯');

    const embed = new EmbedBuilder()
      .setTitle(`${titleEmoji}ACHIEVEMENTS — ${displayName}`)
      .setDescription(`Unlocked **${unlocked.length} / ${ACHIEVEMENTS_REGISTRY.length}** achievements\n\n${lines.join('\n\n')}`)
      .setColor(0xEB459E)
      .setFooter({ text: `${botName} Achievements Engine`, iconURL: client.user?.displayAvatarURL() });

    return message.reply({ embeds: [embed] });
  },
};
