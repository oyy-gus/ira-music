'use strict';

const { EmbedBuilder } = require('discord.js');
const atlantisService = require('../../services/atlantis/atlantisService');
const AtlantisUser = require('../../database/models/AtlantisUser');

module.exports = {
  name: 'resetstats',
  description: 'Reset gaming activity stats for a specific user or force trigger daily reset',
  category: 'developer',
  ownerOnly: true,
  cooldown: 5,
  async execute({ message, args, prefix = '*' }) {
    const subCommand = (args[0] || '').toLowerCase();

    if (subCommand === 'daily') {
      await atlantisService.performDailyStatsReset();
      return message.reply({
        embeds: [
          new EmbedBuilder()
            .setTitle('✅ Daily Stats Reset')
            .setDescription('All daily gaming stats have been reset to 0 across the entire bot database.')
            .setColor(0x57F287),
        ],
      });
    }

    if (subCommand === 'user') {
      const targetUser = message.mentions.users.first() || (args[1] ? { id: args[1].replace(/[<@!>]/g, '') } : null);
      if (!targetUser || !targetUser.id) {
        return message.reply({
          embeds: [
            new EmbedBuilder()
              .setTitle('❌ Missing User')
              .setDescription(`**Usage:** \`${prefix}resetstats user <userId/@user>\``)
              .setColor(0xED4245),
          ],
        });
      }

      await AtlantisUser.updateOne(
        { userId: targetUser.id },
        {
          $set: {
            'stats.owoCount': 0,
            'stats.huntCount': 0,
            'stats.battleCount': 0,
            'stats.praycurseCount': 0,
            'stats.completedHuntbots': 0,
            'stats.totalHuntbotTime': 0,
            'stats.dailyOwoCount': 0,
            'stats.dailyHuntCount': 0,
            'stats.dailyBattleCount': 0,
            'stats.dailyPraycurseCount': 0,
            'stats.guilds': new Map(),
          },
        }
      );

      return message.reply({
        embeds: [
          new EmbedBuilder()
            .setTitle('✅ User Stats Reset')
            .setDescription(`Gaming stats for <@${targetUser.id}> have been completely reset to 0.`)
            .setColor(0x57F287),
        ],
      });
    }

    return message.reply({
      embeds: [
        new EmbedBuilder()
          .setTitle('⚙️ Reset Stats Help')
          .setDescription(
            `• Force daily reset: \`${prefix}resetstats daily\`\n` +
            `• Reset user stats: \`${prefix}resetstats user <userId/@user>\``
          )
          .setColor(0x8B5CF6),
      ],
    });
  },
};
