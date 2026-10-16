const { SlashCommandBuilder } = require('discord.js');
const recCmd = require('../../commands/music/recommend');
const { runAsSlash } = require('../../utils/commandBridge');

module.exports = {
  data: new SlashCommandBuilder().setName('recommend').setDescription('Get recommended tracks based on current playing song'),
  cooldown: 5,
  async execute(interaction, client) {
    await runAsSlash(interaction, client, recCmd);
  },
};
