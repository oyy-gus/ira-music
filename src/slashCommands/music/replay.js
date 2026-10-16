const { SlashCommandBuilder } = require('discord.js');
const replayCmd = require('../../commands/music/replay');
const { runAsSlash } = require('../../utils/commandBridge');

module.exports = {
  data: new SlashCommandBuilder().setName('replay').setDescription('Replay the currently playing track from start'),
  cooldown: 3,
  async execute(interaction, client) {
    await runAsSlash(interaction, client, replayCmd);
  },
};
