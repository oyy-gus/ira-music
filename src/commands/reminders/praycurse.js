'use strict';

const { EmbedBuilder } = require('discord.js');
const atlantisService = require('../../services/atlantis/atlantisService');
const AtlantisUser = require('../../database/models/AtlantisUser');

module.exports = {
  name: 'praycurse',
  description: 'Enable or disable the reminder for `owo pray` / `owo curse`',
  aliases: ['pray', 'curse', 'pc'],
  category: 'reminders',
  cooldown: 3,
  async execute({ message, args }) {
    const user = await atlantisService.getOrCreateUser(message.author.id);
    let newState;

    if (args && args.length > 0) {
      const opt = args[0].toLowerCase();
      if (opt === 'on' || opt === 'enable' || opt === 'true') newState = true;
      else if (opt === 'off' || opt === 'disable' || opt === 'false') newState = false;
      else newState = !user.reminders?.praycurse;
    } else {
      newState = !user.reminders?.praycurse;
    }

    await AtlantisUser.updateOne(
      { userId: message.author.id },
      { $set: { 'reminders.praycurse': newState } }
    );

    const embed = new EmbedBuilder()
      .setTitle('🙏 Pray / Curse Reminder')
      .setDescription(
        newState
          ? `<@${message.author.id}>, You have **enabled** the reminder for \`owo pray/curse\`!`
          : `<@${message.author.id}>, You have **disabled** the reminder for \`owo pray/curse\`!`
      )
      .setColor(newState ? 0x57F287 : 0xED4245)
      .setTimestamp();

    return message.reply({ embeds: [embed] });
  },
};
