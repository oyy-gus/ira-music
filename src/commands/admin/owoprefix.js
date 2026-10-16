'use strict';

const { EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const guildRepo = require('../../database/repositories/guildRepository');

module.exports = {
  name: 'owoprefix',
  description: 'View or set the custom prefix used by the OwO bot in this server for reminder detection',
  category: 'admin',
  cooldown: 3,
  userPermissions: [PermissionFlagsBits.ManageGuild],
  async execute({ message, args, prefix = '*' }) {
    const guildSettings = await guildRepo.getGuildSettings(message.guild.id);
    const currentOwOPrefix = guildSettings?.atlantisSettings?.owoPrefix || 'owo';

    if (!args || args.length === 0) {
      const embed = new EmbedBuilder()
        .setTitle('⚙️ OwO Bot Prefix Configuration')
        .setDescription(
          `Current OwO prefix for **${message.guild.name}**: \`${currentOwOPrefix}\`\n\n` +
          `To change it, use: \`${prefix}owoprefix <new_prefix>\`\n` +
          `*(This prefix is used by reminder triggers like hunt, battle, and pray)*`
        )
        .setColor(0x8B5CF6)
        .setTimestamp();

      return message.reply({ embeds: [embed] });
    }

    const newPrefix = args.join(' ').replace('{space}', ' ').trim();
    if (newPrefix.length > 20) {
      return message.reply({
        embeds: [
          new EmbedBuilder()
            .setTitle('❌ Prefix Too Long')
            .setDescription('OwO prefix length cannot exceed 20 characters.')
            .setColor(0xED4245),
        ],
      });
    }

    await guildRepo.updateGuildSettings(message.guild.id, {
      'atlantisSettings.owoPrefix': newPrefix,
    });

    const embed = new EmbedBuilder()
      .setTitle('✅ OwO Prefix Updated')
      .setDescription(`The OwO prefix for **${message.guild.name}** has been updated to: \`${newPrefix}\``)
      .setColor(0x57F287)
      .setTimestamp();

    return message.reply({ embeds: [embed] });
  },
};
