const { SlashCommandBuilder } = require('discord.js');
const moveCmd = require('../../commands/music/move');
const { runAsSlash } = require('../../utils/commandBridge');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('move')
    .setDescription('Move a track from one position to another in queue')
    .addIntegerOption((opt) => opt.setName('from').setDescription('Current position').setRequired(true).setMinValue(1))
    .addIntegerOption((opt) => opt.setName('to').setDescription('Target position').setRequired(true).setMinValue(1)),
  cooldown: 3,
  async execute(interaction, client) {
    const from = interaction.options.getInteger('from');
    const to = interaction.options.getInteger('to');
    const raw = `${from} ${to}`;
    await runAsSlash(interaction, client, moveCmd, [String(from), String(to)], raw);
  },
};
