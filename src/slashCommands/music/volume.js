const { SlashCommandBuilder } = require('discord.js');
const volumeCmd = require('../../commands/music/volume');
const { runAsSlash } = require('../../utils/commandBridge');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('volume')
    .setDescription('Set or check player volume level (1-100)')
    .addIntegerOption((opt) => opt.setName('level').setDescription('Volume level (1-100)').setMinValue(1).setMaxValue(100)),
  cooldown: 2,
  async execute(interaction, client) {
    const level = interaction.options.getInteger('level');
    await runAsSlash(interaction, client, volumeCmd, level ? [String(level)] : [], level ? String(level) : '');
  },
};
