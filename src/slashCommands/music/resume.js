const { SlashCommandBuilder } = require('discord.js');
const resumeCmd = require('../../commands/music/resume');
const { runAsSlash } = require('../../utils/commandBridge');

module.exports = {
  data: new SlashCommandBuilder().setName('resume').setDescription('Resume paused audio playback'),
  cooldown: 2,
  async execute(interaction, client) {
    await runAsSlash(interaction, client, resumeCmd);
  },
};
