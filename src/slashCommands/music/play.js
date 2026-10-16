const { SlashCommandBuilder } = require('discord.js');
const playCmd = require('../../commands/music/play');
const { runAsSlash } = require('../../utils/commandBridge');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('play')
    .setDescription('Play a track or playlist from YouTube, SoundCloud, or URL')
    .addStringOption((opt) => opt.setName('query').setDescription('Song title or URL').setRequired(true)),
  cooldown: 2,
  async execute(interaction, client) {
    const query = interaction.options.getString('query');
    await runAsSlash(interaction, client, playCmd, [query], query);
  },
};
