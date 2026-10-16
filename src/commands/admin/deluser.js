'use strict';

const { EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const guildRepo = require('../../database/repositories/guildRepository');

module.exports = {
  name: 'deluser',
  description: 'Automatically delete all human user messages in configured channels',
  category: 'admin',
  cooldown: 3,
  userPermissions: [PermissionFlagsBits.ManageGuild],
  async execute({ message, args, prefix = '*' }) {
    const guildSettings = await guildRepo.getGuildSettings(message.guild.id);
    const atlantis = guildSettings?.atlantisSettings || {};
    const channels = [...(atlantis.deleteUserMessagesChannels || [])];

    const subCommand = (args[0] || '').toLowerCase();

    // 1. List channels
    if (!subCommand) {
      const activeMentions = channels.map((cId) => `<#${cId}>`).join(' ') || '*No channels configured.*';

      const embed = new EmbedBuilder()
        .setTitle('👤 Delete User Messages Configuration')
        .setDescription(
          `Messages sent by users in these channels will be automatically removed after ~150ms.\n\n` +
          `**Commands:**\n` +
          `• Add channel: \`${prefix}deluser add #channel\`\n` +
          `• Remove channel: \`${prefix}deluser delete #channel\``
        )
        .addFields({ name: 'Active Channels', value: activeMentions })
        .setColor(0x8B5CF6)
        .setTimestamp();

      return message.reply({ embeds: [embed] });
    }

    const channelTarget = message.mentions.channels.first() || (args[1] ? message.guild.channels.cache.get(args[1].replace(/[<#>]/g, '')) : null);

    if (subCommand === 'add') {
      if (!channelTarget) {
        return message.reply({
          embeds: [new EmbedBuilder().setTitle('❌ Missing Channel').setDescription('Please mention a valid channel: `*deluser add #channel`').setColor(0xED4245)],
        });
      }

      if (channels.includes(channelTarget.id)) {
        return message.reply({
          embeds: [new EmbedBuilder().setTitle('⚠️ Already Added').setDescription(`<#${channelTarget.id}> is already in the user deletion list.`).setColor(0xFEE75C)],
        });
      }

      channels.push(channelTarget.id);
      await guildRepo.updateGuildSettings(message.guild.id, {
        'atlantisSettings.deleteUserMessagesChannels': channels,
      });

      const embed = new EmbedBuilder()
        .setTitle('✅ Channel Added')
        .setDescription(`User messages will now be automatically deleted in <#${channelTarget.id}>.`)
        .setColor(0x57F287)
        .setTimestamp();

      return message.reply({ embeds: [embed] });
    }

    if (subCommand === 'delete' || subCommand === 'remove' || subCommand === 'del') {
      if (!channelTarget) {
        return message.reply({
          embeds: [new EmbedBuilder().setTitle('❌ Missing Channel').setDescription('Please mention a valid channel: `*deluser delete #channel`').setColor(0xED4245)],
        });
      }

      const filtered = channels.filter((id) => id !== channelTarget.id);
      if (filtered.length === channels.length) {
        return message.reply({
          embeds: [new EmbedBuilder().setTitle('⚠️ Not In List').setDescription(`<#${channelTarget.id}> is not currently in the deletion list.`).setColor(0xFEE75C)],
        });
      }

      await guildRepo.updateGuildSettings(message.guild.id, {
        'atlantisSettings.deleteUserMessagesChannels': filtered,
      });

      const embed = new EmbedBuilder()
        .setTitle('✅ Channel Removed')
        .setDescription(`User messages will no longer be deleted in <#${channelTarget.id}>.`)
        .setColor(0x57F287)
        .setTimestamp();

      return message.reply({ embeds: [embed] });
    }

    return message.reply({
      embeds: [new EmbedBuilder().setTitle('❌ Invalid Subcommand').setDescription(`Use \`${prefix}deluser\` to view channels or \`${prefix}deluser add/delete #channel\`.`).setColor(0xED4245)],
    });
  },
};
