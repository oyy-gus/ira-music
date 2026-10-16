'use strict';

const { EmbedBuilder } = require('discord.js');
const atlantisService = require('../../services/atlantis/atlantisService');
const AtlantisUser = require('../../database/models/AtlantisUser');

module.exports = {
  name: 'battle',
  description: 'Enable or disable the reminder for `owo battle`',
  aliases: ['b', 'fight'],
  category: 'reminders',
  cooldown: 3,
  async execute({ message, args }) {
    const user = await atlantisService.getOrCreateUser(message.author.id);
    let newState;

    if (args && args.length > 0) {
      const opt = args[0].toLowerCase();
      if (opt === 'on' || opt === 'enable' || opt === 'true') newState = true;
      else if (opt === 'off' || opt === 'disable' || opt === 'false') newState = false;
      else newState = !user.reminders?.battle;
    } else {
      newState = !user.reminders?.battle;
    }

    await AtlantisUser.updateOne(
      { userId: message.author.id },
      { $set: { 'reminders.battle': newState } }
    );

    const embed = new EmbedBuilder()
      .setTitle('⚔️ Battle Reminder')
      .setDescription(
        newState
          ? `<@${message.author.id}>, You have **enabled** the reminder for \`owo battle\`!`
          : `<@${message.author.id}>, You have **disabled** the reminder for \`owo battle\`!`
      )
      .setColor(newState ? 0x57F287 : 0xED4245)
      .setTimestamp();

    return message.reply({ embeds: [embed] });
  },
};
