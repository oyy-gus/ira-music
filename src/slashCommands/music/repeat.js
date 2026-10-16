const { SlashCommandBuilder } = require('discord.js');
const repeatCmd = require('../../commands/music/repeat');
const { runAsSlash } = require('../../utils/commandBridge');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('repeat')
    .setDescription('Set repeat mode (off, track, queue)')
    .addStringOption((opt) =>
      opt
        .setName('mode')
        .setDescription('Repeat mode')
        .addChoices(
          { name: 'Off', value: 'off' },
          { name: 'Track', value: 'track' },
          { name: 'Queue', value: 'queue' }
        )
    ),
  cooldown: 3,
  async execute(interaction, client) {
    const mode = interaction.options.getString('mode');
    await runAsSlash(interaction, client, repeatCmd, mode ? [mode] : [], mode || '');
  },
};
