'use strict';

const { AttachmentBuilder, EmbedBuilder } = require('discord.js');
const atlantisService = require('../../services/atlantis/atlantisService');
const { generateServerOwoStatsCard } = require('../../utils/atlantisStatsCanvas');

module.exports = {
  name: 'serverstats',
  description: 'View your or another user\'s OwO statistics scoped to this server',
  aliases: ['ss'],
  category: 'utility',
  cooldown: 3,
  async execute({ message, args }) {
    const targetUser = message.mentions.users.first() || (args && args[0] ? message.client.users.cache.get(args[0]) : null) || message.author;
    const userDoc = await atlantisService.getOrCreateUser(targetUser.id);
    const guildsMap = userDoc.stats?.guilds;
    const guildStats = (guildsMap && typeof guildsMap.get === 'function' ? guildsMap.get(message.guild.id) : guildsMap?.[message.guild.id]) || {};

    try {
      const buffer = await generateServerOwoStatsCard({
        user: targetUser,
        guild: message.guild,
        guildStats,
      });

      const attachment = new AttachmentBuilder(buffer, { name: `serverstats-${targetUser.id}.png` });
      return message.reply({ files: [attachment] });
    } catch (err) {
      // Fallback Embed if Canvas fails
      const embed = new EmbedBuilder()
        .setAuthor({
          name: `${targetUser.username}'s Server Activity`,
          iconURL: targetUser.displayAvatarURL ? targetUser.displayAvatarURL({ extension: 'png' }) : null,
        })
        .setTitle(`🏰 Stats in ${message.guild.name}`)
        .setThumbnail(message.guild.iconURL ? message.guild.iconURL({ extension: 'png' }) : null)
        .addFields(
          { name: '💬 Server OwO', value: `\`${guildStats.owoCount || 0}\``, inline: true },
          { name: '🏹 Server Hunt', value: `\`${guildStats.huntCount || 0}\``, inline: true },
          { name: '⚔️ Server Battle', value: `\`${guildStats.battleCount || 0}\``, inline: true },
          { name: '🙏 Server Pray/Curse', value: `\`${guildStats.praycurseCount || 0}\``, inline: true },
          { name: '\u200B', value: '**Server Daily Activity**', inline: false },
          { name: '📅 Daily OwO', value: `\`${guildStats.dailyOwoCount || 0}\``, inline: true },
          { name: '📅 Daily Hunt', value: `\`${guildStats.dailyHuntCount || 0}\``, inline: true },
          { name: '📅 Daily Battle', value: `\`${guildStats.dailyBattleCount || 0}\``, inline: true },
          { name: '📅 Daily Pray/Curse', value: `\`${guildStats.dailyPraycurseCount || 0}\``, inline: true }
        )
        .setColor(0x8B5CF6)
        .setTimestamp();

      return message.reply({ embeds: [embed] });
    }
  },
};
