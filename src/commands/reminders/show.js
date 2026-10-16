'use strict';

const { EmbedBuilder } = require('discord.js');
const atlantisService = require('../../services/atlantis/atlantisService');

module.exports = {
  name: 'show',
  description: 'View the status of your game reminder toggles',
  aliases: ['reminders', 'showreminders'],
  category: 'reminders',
  cooldown: 3,
  async execute({ message }) {
    const userDoc = await atlantisService.getOrCreateUser(message.author.id);
    const r = userDoc.reminders || {};

    const formatStatus = (enabled) => (enabled ? '`🟢 Enabled`' : '`🔴 Disabled`');

    const embed = new EmbedBuilder()
      .setAuthor({
        name: `${message.author.username}'s Reminder Settings`,
        iconURL: message.author.displayAvatarURL({ extension: 'png' }),
      })
      .setTitle('🔔 Game Reminder Preferences')
      .setDescription('Toggle any reminder on or off using the command name (e.g. `*hunt`, `*battle`, `*owo`).')
      .addFields(
        { name: '🏹 Hunt (`*hunt`)', value: formatStatus(r.hunt), inline: true },
        { name: '⚔️ Battle (`*battle`)', value: formatStatus(r.battle), inline: true },
        { name: '🙏 Pray/Curse (`*praycurse`)', value: formatStatus(r.praycurse), inline: true },
        { name: '⏰ HuntBot (`*huntbot`)', value: formatStatus(r.huntbot), inline: true },
        { name: '💬 OwO/UwU (`*owo`)', value: formatStatus(r.owo), inline: true }
      )
      .setColor(0x8B5CF6)
      .setFooter({ text: 'Use *custom to manage custom keyword timers' })
      .setTimestamp();

    return message.reply({ embeds: [embed] });
  },
};
