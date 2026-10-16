const { SlashCommandBuilder } = require('discord.js');
const clearCmd = require('../../commands/music/clear');
const { runAsSlash } = require('../../utils/commandBridge');

module.exports = {
  data: new SlashCommandBuilder().setName('clear').setDescription('Clear all tracks from queue'),
  cooldown: 3,
  async execute(interaction, client) {
    await runAsSlash(interaction, client, clearCmd);
  },
};
