'use strict';

const { AttachmentBuilder, EmbedBuilder } = require('discord.js');
const atlantisService = require('../../services/atlantis/atlantisService');
const { generateServerOwoStatsCard, generateGlobalOwoStatsCard } = require('../../utils/atlantisStatsCanvas');

module.exports = {
  name: 'owostats',
  description: 'View your or another user\'s OwO statistics in this server (or use "global" for all servers)',
  aliases: ['ostats', 'owos', 'gamerstats'],
  category: 'utility',
  cooldown: 3,
  async execute({ message, args, prefix = '*' }) {
    // Check if user explicitly asked for global view
    const isGlobal = (args || []).some((a) => a.toLowerCase() === 'global' || a.toLowerCase() === 'g');

    // Filter out 'global' from args to find target user
    const userArgs = (args || []).filter((a) => a.toLowerCase() !== 'global' && a.toLowerCase() !== 'g');

    const targetUser =
      message.mentions.users.first() ||
      (userArgs[0] ? message.client.users.cache.get(userArgs[0].replace(/[<@!>]/g, '')) : null) ||
      message.author;

    const userDoc = await atlantisService.getOrCreateUser(targetUser.id);
    const guildsMap = userDoc.stats?.guilds;
    const guildStats =
      (guildsMap && typeof guildsMap.get === 'function'
        ? guildsMap.get(message.guild.id)
        : guildsMap?.[message.guild.id]) || {};

    try {
      let buffer;
      if (isGlobal || !message.guild) {
        // Global stats across all servers combined
        buffer = await generateGlobalOwoStatsCard({
          user: targetUser,
          stats: userDoc.stats || {},
        });
      } else {
        // Per-player & Per-server stats (Server A and Server B are isolated)
        buffer = await generateServerOwoStatsCard({
          user: targetUser,
          guild: message.guild,
          guildStats,
        });
      }

      const filename = isGlobal
        ? `owostats-global-${targetUser.id}.png`
        : `owostats-${message.guild?.id || 'server'}-${targetUser.id}.png`;

      const attachment = new AttachmentBuilder(buffer, { name: filename });
      return message.reply({ files: [attachment] });
    } catch (err) {
      // Fallback Embed if Canvas fails
      const embed = new EmbedBuilder()
        .setAuthor({
          name: `${targetUser.username}'s ${isGlobal ? 'Global' : message.guild?.name || 'Server'} OwO Stats`,
          iconURL: targetUser.displayAvatarURL ? targetUser.displayAvatarURL({ extension: 'png' }) : null,
        })
        .setTitle(isGlobal ? '🌐 Gaming & Activity Overview (Global)' : `🏰 Stats in ${message.guild?.name || 'This Server'}`)
        .addFields(
          { name: '💬 OwO Count', value: `\`${isGlobal ? (userDoc.stats?.owoCount || 0) : (guildStats.owoCount || 0)}\``, inline: true },
          { name: '🏹 Hunt Count', value: `\`${isGlobal ? (userDoc.stats?.huntCount || 0) : (guildStats.huntCount || 0)}\``, inline: true },
          { name: '⚔️ Battle Count', value: `\`${isGlobal ? (userDoc.stats?.battleCount || 0) : (guildStats.battleCount || 0)}\``, inline: true },
          { name: '🙏 Pray/Curse Count', value: `\`${isGlobal ? (userDoc.stats?.praycurseCount || 0) : (guildStats.praycurseCount || 0)}\``, inline: true },
          { name: '\u200B', value: '**Daily Activity (Resets Midnight UTC)**', inline: false },
          { name: '📅 Daily OwO', value: `\`${isGlobal ? (userDoc.stats?.dailyOwoCount || 0) : (guildStats.dailyOwoCount || 0)}\``, inline: true },
          { name: '📅 Daily Hunt', value: `\`${isGlobal ? (userDoc.stats?.dailyHuntCount || 0) : (guildStats.dailyHuntCount || 0)}\``, inline: true },
          { name: '📅 Daily Battle', value: `\`${isGlobal ? (userDoc.stats?.dailyBattleCount || 0) : (guildStats.dailyBattleCount || 0)}\``, inline: true },
          { name: '📅 Daily Pray/Curse', value: `\`${isGlobal ? (userDoc.stats?.dailyPraycurseCount || 0) : (guildStats.dailyPraycurseCount || 0)}\``, inline: true }
        )
        .setFooter({
          text: isGlobal ? 'Viewing global stats' : `Tip: Use ${prefix}owostats global to view stats across all servers`,
        })
        .setColor(0x8B5CF6)
        .setTimestamp();

      return message.reply({ embeds: [embed] });
    }
  },
};
