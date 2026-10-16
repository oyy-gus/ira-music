const { EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const guildRepo = require('../../database/repositories/guildRepository');
const { getEmoji } = require('../../config/emojis');

module.exports = {
  name: 'settings',
  description: 'View or update guild music & levelup settings',
  aliases: ['config', 'setting'],
  category: 'utility',
  cooldown: 3,
  userPermissions: [PermissionFlagsBits.ManageGuild],
  async execute({ message, args, prefix, client }) {
    const emoji = (key) => {
      const e = getEmoji(key, client);
      return e ? `${e} ` : '';
    };

    const settings = await guildRepo.getGuildSettings(message.guild.id);

    if (!args || args.length === 0) {
      const lvlChan = settings.musicSettings?.levelUpChannelId
        ? `<#${settings.musicSettings.levelUpChannelId}>`
        : 'Active Music Channel (Default)';

      const embed = new EmbedBuilder()
        .setTitle(`${emoji('settings')}Guild Settings for ${message.guild.name}`)
        .addFields(
          { name: 'Prefix', value: `\`${settings.prefix || '*'}\``, inline: true },
          { name: 'Default Volume', value: `\`${settings.musicSettings?.defaultVolume || 100}%\``, inline: true },
          { name: 'Max Queue Size', value: `\`${settings.musicSettings?.maxQueueSize || 500}\``, inline: true },
          { name: 'Default Autoplay', value: `\`${settings.musicSettings?.autoplay ? 'Enabled' : 'Disabled'}\``, inline: true },
          { name: 'Level-Up Channel', value: lvlChan, inline: true }
        )
        .setDescription(`**Subcommands:**\n• \`${prefix}settings volume <1-150>\` — Set default volume\n• \`${prefix}settings maxqueue <10-1000>\` — Set max queue size\n• \`${prefix}settings levelupchannel [#channel|off]\` — Set level-up notification channel\n• \`${prefix}settings prefix <new_prefix>\` — Change server prefix`)
        .setColor(0x5865F2);
      return message.reply({ embeds: [embed] });
    }

    const sub = args[0].toLowerCase();
    const value = args[1];

    if (sub === 'volume' || sub === 'defvolume') {
      const vol = parseInt(value, 10);
      if (isNaN(vol) || vol < 1 || vol > 150) {
        const embed = new EmbedBuilder()
          .setTitle(`${emoji('error')}Invalid Volume`)
          .setDescription('Default volume must be a number between 1 and 150.')
          .setColor(0xED4245);
        return message.reply({ embeds: [embed] });
      }

      await guildRepo.updateGuildSettings(message.guild.id, {
        'musicSettings.defaultVolume': vol,
      });

      const embed = new EmbedBuilder()
        .setTitle(`${emoji('success')}Setting Updated`)
        .setDescription(`Default playback volume set to **${vol}%**.`)
        .setColor(0x57F287);
      return message.reply({ embeds: [embed] });
    }

    if (sub === 'maxqueue' || sub === 'queuelimit') {
      const limit = parseInt(value, 10);
      if (isNaN(limit) || limit < 10 || limit > 1000) {
        const embed = new EmbedBuilder()
          .setTitle(`${emoji('error')}Invalid Limit`)
          .setDescription('Max queue size must be a number between 10 and 1000.')
          .setColor(0xED4245);
        return message.reply({ embeds: [embed] });
      }

      await guildRepo.updateGuildSettings(message.guild.id, {
        'musicSettings.maxQueueSize': limit,
      });

      const embed = new EmbedBuilder()
        .setTitle(`${emoji('success')}Setting Updated`)
        .setDescription(`Maximum queue size limit set to **${limit} tracks**.`)
        .setColor(0x57F287);
      return message.reply({ embeds: [embed] });
    }

    if (sub === 'levelupchannel' || sub === 'levelup') {
      const channel = message.mentions.channels.first();
      const channelId = channel ? channel.id : (value === 'off' || value === 'none' ? null : null);
      await guildRepo.updateGuildSettings(message.guild.id, {
        'musicSettings.levelUpChannelId': channelId,
      });

      const desc = channelId
        ? `Level-Up notifications will now be sent to <#${channelId}>!`
        : `Level-Up channel reset to default (Active Music Channel).`;

      const embed = new EmbedBuilder()
        .setTitle(`${emoji('success')}Level-Up Channel Updated`)
        .setDescription(desc)
        .setColor(0x57F287);
      return message.reply({ embeds: [embed] });
    }

    const embed = new EmbedBuilder()
      .setTitle(`${emoji('error')}Unknown Setting`)
      .setDescription(`Invalid option. Use \`${prefix}settings\` to view available configuration options.`);
    return message.reply({ embeds: [embed] });
  },
};
