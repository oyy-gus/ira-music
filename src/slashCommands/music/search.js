const { SlashCommandBuilder } = require('discord.js');
const searchCmd = require('../../commands/music/search');
const { runAsSlash } = require('../../utils/commandBridge');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('search')
    .setDescription('Search for audio tracks and choose from results')
    .addStringOption((opt) => opt.setName('query').setDescription('Search keywords').setRequired(true)),
  cooldown: 3,
  async execute(interaction, client) {
    const query = interaction.options.getString('query');
    await runAsSlash(interaction, client, searchCmd, [query], query);
  },
};
