const { SlashCommandBuilder } = require('discord.js');
const npCmd = require('../../commands/music/nowplaying');
const { runAsSlash } = require('../../utils/commandBridge');

module.exports = {
  data: new SlashCommandBuilder().setName('nowplaying').setDescription('Show information about the currently playing track'),
  cooldown: 3,
  async execute(interaction, client) {
    await runAsSlash(interaction, client, npCmd);
  },
};
