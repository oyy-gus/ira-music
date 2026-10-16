const { SlashCommandBuilder } = require('discord.js');
const jumpCmd = require('../../commands/music/jump');
const { runAsSlash } = require('../../utils/commandBridge');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('jump')
    .setDescription('Jump to a specific track position in the queue')
    .addIntegerOption((opt) => opt.setName('position').setDescription('Track position number').setRequired(true).setMinValue(1)),
  cooldown: 3,
  async execute(interaction, client) {
    const pos = interaction.options.getInteger('position');
    await runAsSlash(interaction, client, jumpCmd, [String(pos)], String(pos));
  },
};
