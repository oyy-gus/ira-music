'use strict';

const { EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const guildRepo = require('../../database/repositories/guildRepository');

module.exports = {
  name: 'delete',
  description: 'Delete all messages in a channel that start with a specific word or command prefix',
  category: 'admin',
  cooldown: 3,
  userPermissions: [PermissionFlagsBits.ManageGuild],
  async execute({ message, args, prefix = '*' }) {
    const guildSettings = await guildRepo.getGuildSettings(message.guild.id);
    const atlantis = guildSettings?.atlantisSettings || {};
    const rules = [...(atlantis.deleteRules || [])];

    const subCommand = (args[0] || '').toLowerCase();

    // 1. List rules
    if (!subCommand) {
      const activeRules = rules
        .map((r) => `<#${r.channelId}> — starts with \`${r.word}\``)
        .join('\n') || '*No deletion rules configured.*';

      const embed = new EmbedBuilder()
        .setTitle('🗑️ Custom Message Deletion Rules')
        .setDescription(
          `Configure channels to delete messages starting with a specific prefix/word.\n\n` +
          `**Commands:**\n` +
          `• Add rule: \`${prefix}delete add <word> #channel\`\n` +
          `  - *Example:* \`${prefix}delete add !play #bot-spam\`\n` +
          `• Delete rule: \`${prefix}delete delete <word> #channel\``
        )
        .addFields({ name: 'Active Rules', value: activeRules })
        .setColor(0x8B5CF6)
        .setTimestamp();

      return message.reply({ embeds: [embed] });
    }

    const word = args[1]?.toLowerCase();
    const channelTarget = message.mentions.channels.first() || (args[2] ? message.guild.channels.cache.get(args[2].replace(/[<#>]/g, '')) : null);

    if (subCommand === 'add') {
      if (!word || !channelTarget) {
        return message.reply({
          embeds: [
            new EmbedBuilder()
              .setTitle('❌ Missing Parameters')
              .setDescription(`**Usage:** \`${prefix}delete add <word> #channel\``)
              .setColor(0xED4245),
          ],
        });
      }

      const exists = rules.some((r) => r.channelId === channelTarget.id && r.word.toLowerCase() === word);
      if (exists) {
        return message.reply({
          embeds: [
            new EmbedBuilder()
              .setTitle('⚠️ Rule Exists')
              .setDescription(`A rule for word \`${word}\` in <#${channelTarget.id}> is already active.`)
              .setColor(0xFEE75C),
          ],
        });
      }

      rules.push({ channelId: channelTarget.id, word });
      await guildRepo.updateGuildSettings(message.guild.id, {
        'atlantisSettings.deleteRules': rules,
      });

      const embed = new EmbedBuilder()
        .setTitle('✅ Rule Added')
        .setDescription(`Messages in <#${channelTarget.id}> starting with \`${word}\` will now be automatically deleted.`)
        .setColor(0x57F287)
        .setTimestamp();

      return message.reply({ embeds: [embed] });
    }

    if (subCommand === 'delete' || subCommand === 'remove' || subCommand === 'del') {
      if (!word || !channelTarget) {
        return message.reply({
          embeds: [
            new EmbedBuilder()
              .setTitle('❌ Missing Parameters')
              .setDescription(`**Usage:** \`${prefix}delete delete <word> #channel\``)
              .setColor(0xED4245),
          ],
        });
      }

      const filtered = rules.filter((r) => !(r.channelId === channelTarget.id && r.word.toLowerCase() === word));
      if (filtered.length === rules.length) {
        return message.reply({
          embeds: [
            new EmbedBuilder()
              .setTitle('⚠️ Rule Not Found')
              .setDescription(`No rule matching word \`${word}\` in <#${channelTarget.id}> was found.`)
              .setColor(0xFEE75C),
          ],
        });
      }

      await guildRepo.updateGuildSettings(message.guild.id, {
        'atlantisSettings.deleteRules': filtered,
      });

      const embed = new EmbedBuilder()
        .setTitle('✅ Rule Removed')
        .setDescription(`Messages in <#${channelTarget.id}> starting with \`${word}\` will no longer be deleted.`)
        .setColor(0x57F287)
        .setTimestamp();

      return message.reply({ embeds: [embed] });
    }

    return message.reply({
      embeds: [
        new EmbedBuilder()
          .setTitle('❌ Invalid Subcommand')
          .setDescription(`Use \`${prefix}delete\` to view rules or \`${prefix}delete add/delete <word> #channel\`.`)
          .setColor(0xED4245),
      ],
    });
  },
};
