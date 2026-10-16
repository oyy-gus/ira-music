const { SlashCommandBuilder } = require('discord.js');
const shuffleCmd = require('../../commands/music/shuffle');
const { runAsSlash } = require('../../utils/commandBridge');

module.exports = {
  data: new SlashCommandBuilder().setName('shuffle').setDescription('Shuffle all tracks in current queue'),
  cooldown: 3,
  async execute(interaction, client) {
    await runAsSlash(interaction, client, shuffleCmd);
  },
};
