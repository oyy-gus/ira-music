const { SlashCommandBuilder } = require('discord.js');
const removeCmd = require('../../commands/music/remove');
const { runAsSlash } = require('../../utils/commandBridge');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('remove')
    .setDescription('Remove a track from queue by position number')
    .addIntegerOption((opt) => opt.setName('position').setDescription('Track position to remove').setRequired(true).setMinValue(1)),
  cooldown: 3,
  async execute(interaction, client) {
    const pos = interaction.options.getInteger('position');
    await runAsSlash(interaction, client, removeCmd, [String(pos)], String(pos));
  },
};
