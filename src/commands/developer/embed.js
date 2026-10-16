'use strict';

const { EmbedBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
  name: 'embed',
  description: 'Construct and dispatch a rich custom embed to a target channel',
  category: 'developer',
  ownerOnly: true,
  cooldown: 3,
  async execute({ message, args, rawArgsString, prefix = '*' }) {
    if (!rawArgsString) {
      return message.reply({
        embeds: [
          new EmbedBuilder()
            .setTitle('ℹ️ Custom Embed Generator')
            .setDescription(
              `**Usage Methods:**\n\n` +
              `**Method 1: Pipe syntax**\n` +
              `\`${prefix}embed [#channel] Title | Description | [Optional Color Hex]\`\n` +
              `*Example:* \`${prefix}embed #general Server Announcement | Welcome to the updated bot! | #8B5CF6\`\n\n` +
              `**Method 2: JSON Payload**\n` +
              `\`${prefix}embed #channel {"title": "Hello", "description": "World", "color": 5793266}\``
            )
            .setColor(0x8B5CF6),
        ],
      });
    }

    let targetChannel = message.mentions.channels.first();
    let textToParse = rawArgsString;

    if (targetChannel) {
      textToParse = textToParse.replace(/<#\d+>/, '').trim();
    } else {
      targetChannel = message.channel;
    }

    // Attempt JSON parsing first
    if (textToParse.startsWith('{') && textToParse.endsWith('}')) {
      try {
        const parsed = JSON.parse(textToParse);
        const embed = EmbedBuilder.from(parsed);
        await targetChannel.send({ embeds: [embed] });
        return message.reply({
          embeds: [new EmbedBuilder().setTitle('✅ Embed Dispatched').setDescription(`Sent to <#${targetChannel.id}>.`).setColor(0x57F287)],
        });
      } catch (e) {
        return message.reply({
          embeds: [new EmbedBuilder().setTitle('❌ Invalid JSON').setDescription(e.message).setColor(0xED4245)],
        });
      }
    }

    // Pipe syntax: title | description | [color]
    const parts = textToParse.split('|').map((p) => p.trim());
    if (parts.length < 2) {
      return message.reply({
        embeds: [
          new EmbedBuilder()
            .setTitle('❌ Missing Fields')
            .setDescription(`Provide at least a Title and Description separated by \`|\`.\n*Example:* \`${prefix}embed Announcement | We updated! | #57F287\``)
            .setColor(0xED4245),
        ],
      });
    }

    const title = parts[0];
    const description = parts[1];
    let color = 0x8B5CF6;

    if (parts[2]) {
      const hex = parts[2].replace('#', '');
      const parsedHex = parseInt(hex, 16);
      if (!isNaN(parsedHex)) color = parsedHex;
    }

    const embed = new EmbedBuilder()
      .setTitle(title)
      .setDescription(description)
      .setColor(color)
      .setTimestamp();

    await targetChannel.send({ embeds: [embed] });

    return message.reply({
      embeds: [
        new EmbedBuilder()
          .setTitle('✅ Embed Dispatched')
          .setDescription(`Successfully sent embed to <#${targetChannel.id}>.`)
          .setColor(0x57F287),
      ],
    });
  },
};
