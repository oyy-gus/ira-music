'use strict';

const { EmbedBuilder } = require('discord.js');
const { calculateZooStats } = require('../../services/atlantis/zooCalculator');

module.exports = {
  name: 'zoostats',
  description: 'Calculate Cowoncy, Essence, and Points from OwO zoo messages with superscript numbers',
  aliases: ['zoo'],
  category: 'utility',
  cooldown: 5,
  async execute({ message, args, prefix = '*' }) {
    let combinedContent = '';

    // Check if replying to a message
    if (message.reference && message.reference.messageId) {
      try {
        const refMsg = await message.channel.messages.fetch(message.reference.messageId);
        if (refMsg) combinedContent += refMsg.content + '\n';
      } catch (_) {}
    }

    // Check provided message IDs in arguments
    if (args && args.length > 0) {
      for (const arg of args) {
        // If it's a numeric message ID
        if (/^\d{17,20}$/.test(arg)) {
          try {
            const fetched = await message.channel.messages.fetch(arg);
            if (fetched) combinedContent += fetched.content + '\n';
          } catch (_) {}
        }
      }
    }

    if (!combinedContent.trim()) {
      return message.reply({
        embeds: [
          new EmbedBuilder()
            .setTitle('❌ Missing Zoo Message')
            .setDescription(
              `Please provide one or more Message IDs containing the zoo output, or reply to a zoo message with \`${prefix}zoostats\`!\n\n` +
              `**Example:** \`${prefix}zoostats 705892150937616424 705892158302552095\``
            )
            .setColor(0xED4245),
        ],
      });
    }

    const result = calculateZooStats(combinedContent);

    if (Object.keys(result.totals).length === 0) {
      return message.reply({
        embeds: [
          new EmbedBuilder()
            .setTitle('⚠️ No Animals Detected')
            .setDescription('Could not find any animal rank emojis or superscript numbers in the specified messages.')
            .setColor(0xFEE75C),
        ],
      });
    }

    const embed = new EmbedBuilder()
      .setAuthor({
        name: `${message.author.username}'s Zoo Valuation`,
        iconURL: message.author.displayAvatarURL({ extension: 'png' }),
      })
      .setTitle(`Total: ${result.formattedCowoncy} Cowoncy | ${result.formattedEssence} Essence`)
      .setDescription(result.formatted)
      .setColor(0x3B82F6)
      .setTimestamp();

    return message.reply({ embeds: [embed] });
  },
};
