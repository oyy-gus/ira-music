'use strict';

const { EmbedBuilder } = require('discord.js');
const atlantisService = require('../../services/atlantis/atlantisService');

module.exports = {
  name: 'botban',
  description: 'Manage global bot ban list (ban/unban users from using the bot)',
  category: 'developer',
  ownerOnly: true,
  cooldown: 3,
  async execute({ message, args, prefix = '*' }) {
    const subCommand = (args[0] || '').toLowerCase();

    // 1. List bans
    if (!subCommand) {
      const bans = await atlantisService.getAllBotBans();

      const embed = new EmbedBuilder()
        .setTitle('🚫 Globally Banned Users')
        .setDescription(
          `**Commands:**\n` +
          `• Ban user: \`${prefix}botban <userId/@user> [reason]\`\n` +
          `• Unban user: \`${prefix}botban delete <userId/@user>\``
        )
        .setColor(0xED4245)
        .setTimestamp();

      if (bans.length === 0) {
        embed.addFields({ name: 'Banned Users', value: '*No users are currently bot-banned.*' });
      } else {
        const listStr = bans
          .slice(0, 25)
          .map((b) => `• <@${b.userId}> (\`${b.userId}\`): ${b.reason || 'No reason'} *(by ${b.bannedBy || 'Admin'})*`)
          .join('\n');
        embed.addFields({ name: `Banned Users (${bans.length})`, value: listStr });
      }

      return message.reply({ embeds: [embed] });
    }

    // 2. Unban user
    if (subCommand === 'delete' || subCommand === 'unban' || subCommand === 'remove') {
      const targetUser = message.mentions.users.first() || (args[1] ? { id: args[1].replace(/[<@!>]/g, '') } : null);
      if (!targetUser || !targetUser.id) {
        return message.reply({
          embeds: [new EmbedBuilder().setTitle('❌ Missing User').setDescription(`**Usage:** \`${prefix}botban delete <userId/@user>\``).setColor(0xED4245)],
        });
      }

      await atlantisService.removeBotBan(targetUser.id);

      const embed = new EmbedBuilder()
        .setTitle('✅ User Unbanned')
        .setDescription(`<@${targetUser.id}> (\`${targetUser.id}\`) has been unbanned from using the bot.`)
        .setColor(0x57F287)
        .setTimestamp();

      return message.reply({ embeds: [embed] });
    }

    // 3. Ban user
    const targetUser = message.mentions.users.first() || { id: args[0].replace(/[<@!>]/g, '') };
    if (!targetUser.id || !/^\d{17,20}$/.test(targetUser.id)) {
      return message.reply({
        embeds: [new EmbedBuilder().setTitle('❌ Invalid User ID').setDescription('Please provide a valid User ID or mention.').setColor(0xED4245)],
      });
    }

    const reason = args.slice(1).join(' ') || 'Violating bot policies';
    await atlantisService.addBotBan(targetUser.id, targetUser.username || '', reason, message.author.tag);

    const embed = new EmbedBuilder()
      .setTitle('🔨 User Bot-Banned')
      .setDescription(`<@${targetUser.id}> (\`${targetUser.id}\`) has been banned from using the bot.\n\n**Reason:** \`${reason}\``)
      .setColor(0xED4245)
      .setTimestamp();

    return message.reply({ embeds: [embed] });
  },
};
