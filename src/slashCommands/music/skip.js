const { SlashCommandBuilder } = require('discord.js');
const skipCmd = require('../../commands/music/skip');
const { runAsSlash } = require('../../utils/commandBridge');

module.exports = {
  data: new SlashCommandBuilder().setName('skip').setDescription('Skip the currently playing track'),
  cooldown: 2,
  async execute(interaction, client) {
    await runAsSlash(interaction, client, skipCmd);
  },
};
