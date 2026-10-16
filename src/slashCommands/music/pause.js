const { SlashCommandBuilder } = require('discord.js');
const pauseCmd = require('../../commands/music/pause');
const { runAsSlash } = require('../../utils/commandBridge');

module.exports = {
  data: new SlashCommandBuilder().setName('pause').setDescription('Pause the current audio playback'),
  cooldown: 2,
  async execute(interaction, client) {
    await runAsSlash(interaction, client, pauseCmd);
  },
};
