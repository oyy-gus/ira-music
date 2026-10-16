'use strict';

const { EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const guildRepo = require('../../database/repositories/guildRepository');

module.exports = {
  name: 'owochannel',
  description: 'Designate channels where only "owo" and "uwu" messages are allowed (all others are deleted)',
  category: 'admin',
  cooldown: 3,
  userPermissions: [PermissionFlagsBits.ManageGuild],
  async execute({ message, args, prefix = '*' }) {
    const guildSettings = await guildRepo.getGuildSettings(message.guild.id);
    const atlantis = guildSettings?.atlantisSettings || {};
    const channels = [...(atlantis.owoChannels || [])];

    const subCommand = (args[0] || '').toLowerCase();

    // 1. List channels
    if (!subCommand) {
      const activeMentions = channels.map((cId) => `<#${cId}>`).join(' ') || '*No channels configured.*';

      const embed = new EmbedBuilder()
        .setTitle('(｡♥‿♥｡) OwO-Only Channels Configuration')
        .setDescription(
          `In these channels, any message other than \`owo\` or \`uwu\` will be automatically deleted after ~150ms.\n\n` +
          `**Commands:**\n` +
          `• Add channel: \`${prefix}owochannel add #channel\`\n` +
          `• Remove channel: \`${prefix}owochannel delete #channel\``
        )
        .addFields({ name: 'Active OwO Channels', value: activeMentions })
        .setColor(0x8B5CF6)
        .setTimestamp();

      return message.reply({ embeds: [embed] });
    }

    const channelTarget = message.mentions.channels.first() || (args[1] ? message.guild.channels.cache.get(args[1].replace(/[<#>]/g, '')) : null);

    if (subCommand === 'add') {
      if (!channelTarget) {
        return message.reply({
          embeds: [new EmbedBuilder().setTitle('❌ Missing Channel').setDescription('Please mention a valid channel: `*owochannel add #channel`').setColor(0xED4245)],
        });
      }

      if (channels.includes(channelTarget.id)) {
        return message.reply({
          embeds: [new EmbedBuilder().setTitle('⚠️ Already Added').setDescription(`<#${channelTarget.id}> is already set as an OwO channel.`).setColor(0xFEE75C)],
        });
      }

      channels.push(channelTarget.id);
      await guildRepo.updateGuildSettings(message.guild.id, {
        'atlantisSettings.owoChannels': channels,
      });

      const embed = new EmbedBuilder()
        .setTitle('✅ OwO Channel Added')
        .setDescription(`All messages except \`owo\` / \`uwu\` will now be deleted in <#${channelTarget.id}>.`)
        .setColor(0x57F287)
        .setTimestamp();

      return message.reply({ embeds: [embed] });
    }

    if (subCommand === 'delete' || subCommand === 'remove' || subCommand === 'del') {
      if (!channelTarget) {
        return message.reply({
          embeds: [new EmbedBuilder().setTitle('❌ Missing Channel').setDescription('Please mention a valid channel: `*owochannel delete #channel`').setColor(0xED4245)],
        });
      }

      const filtered = channels.filter((id) => id !== channelTarget.id);
      if (filtered.length === channels.length) {
        return message.reply({
          embeds: [new EmbedBuilder().setTitle('⚠️ Not In List').setDescription(`<#${channelTarget.id}> is not currently in the OwO channels list.`).setColor(0xFEE75C)],
        });
      }

      await guildRepo.updateGuildSettings(message.guild.id, {
        'atlantisSettings.owoChannels': filtered,
      });

      const embed = new EmbedBuilder()
        .setTitle('✅ OwO Channel Removed')
        .setDescription(`Messages other than \`owo\` will no longer be deleted in <#${channelTarget.id}>.`)
        .setColor(0x57F287)
        .setTimestamp();

      return message.reply({ embeds: [embed] });
    }

    return message.reply({
      embeds: [new EmbedBuilder().setTitle('❌ Invalid Subcommand').setDescription(`Use \`${prefix}owochannel\` to view channels or \`${prefix}owochannel add/delete #channel\`.`).setColor(0xED4245)],
    });
  },
};
