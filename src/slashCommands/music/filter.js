const { SlashCommandBuilder } = require('discord.js');
const filterCmd = require('../../commands/music/filter');
const { runAsSlash } = require('../../utils/commandBridge');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('filter')
    .setDescription('Apply audio equalizer audio filter presets')
    .addStringOption((opt) =>
      opt
        .setName('preset')
        .setDescription('Audio filter preset')
        .setRequired(true)
        .addChoices(
          { name: 'Off / Clear', value: 'off' },
          { name: 'Bassboost', value: 'bassboost' },
          { name: '8D Audio', value: '8d' },
          { name: 'Nightcore', value: 'nightcore' },
          { name: 'Vaporwave', value: 'vaporwave' },
          { name: 'Pop', value: 'pop' },
          { name: 'Soft', value: 'soft' }
        )
    ),
  cooldown: 3,
  async execute(interaction, client) {
    const preset = interaction.options.getString('preset');
    await runAsSlash(interaction, client, filterCmd, [preset], preset);
  },
};
