const { EmbedBuilder } = require('discord.js');
const featureFlagService = require('../../services/featureFlagService');
const { getEmoji } = require('../../config/emojis');

module.exports = {
  name: 'maintenance',
  description: 'Toggle global maintenance mode',
  aliases: ['maint', 'maintmode'],
  category: 'developer',
  ownerOnly: true,
  cooldown: 0,
  async execute({ message, args, rawArgsString, prefix, client }) {
    const emoji = (key) => {
      const e = getEmoji(key, client);
      return e ? `${e} ` : '';
    };

    if (!args.length) {
      const isMaint = featureFlagService.isMaintenance();
      const currentMsg = featureFlagService.maintenanceMode.message;
      const embed = new EmbedBuilder()
        .setTitle(`${emoji('tools')}Maintenance Mode Status`)
        .addFields(
          { name: 'Status', value: isMaint ? `${emoji('error')}**ENABLED**` : `${emoji('success')}**DISABLED**`, inline: true },
          { name: 'Custom Message', value: currentMsg, inline: false }
        )
        .setDescription(`Usage: \`${prefix}maintenance on [message]\` or \`${prefix}maintenance off\``)
        .setColor(isMaint ? 0xED4245 : 0x57F287);
      return message.reply({ embeds: [embed] });
    }

    const action = args[0].toLowerCase();
    if (action === 'on' || action === 'enable') {
      const customMsg = args.slice(1).join(' ') || undefined;
      featureFlagService.setMaintenance(true, customMsg);
      const embed = new EmbedBuilder()
        .setTitle(`${emoji('warning')}Maintenance Mode Enabled`)
        .setDescription(`Global maintenance is now **ACTIVE**.\nMessage: "${featureFlagService.maintenanceMode.message}"`)
        .setColor(0xED4245);
      return message.reply({ embeds: [embed] });
    } else if (action === 'off' || action === 'disable') {
      featureFlagService.setMaintenance(false);
      const embed = new EmbedBuilder()
        .setTitle(`${emoji('success')}Maintenance Mode Disabled`)
        .setDescription('Global maintenance mode is now **INACTIVE**. Normal command processing resumed.')
        .setColor(0x57F287);
      return message.reply({ embeds: [embed] });
    } else {
      return message.reply(`${emoji('error')}Invalid action! Usage: \`${prefix}maintenance on [message]\` or \`${prefix}maintenance off\``);
    }
  },
};
