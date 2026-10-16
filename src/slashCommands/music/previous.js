const { SlashCommandBuilder } = require('discord.js');
const prevCmd = require('../../commands/music/previous');
const { runAsSlash } = require('../../utils/commandBridge');

module.exports = {
  data: new SlashCommandBuilder().setName('previous').setDescription('Replay the previously played track'),
  cooldown: 3,
  async execute(interaction, client) {
    await runAsSlash(interaction, client, prevCmd);
  },
};
