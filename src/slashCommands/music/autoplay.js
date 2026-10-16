const { SlashCommandBuilder } = require('discord.js');
const autoplayCmd = require('../../commands/music/autoplay');
const { runAsSlash } = require('../../utils/commandBridge');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('autoplay')
    .setDescription('Toggle automatic track recommendations when queue finishes')
    .addStringOption((opt) =>
      opt.setName('state').setDescription('Toggle mode').addChoices({ name: 'On', value: 'on' }, { name: 'Off', value: 'off' })
    ),
  cooldown: 3,
  async execute(interaction, client) {
    const state = interaction.options.getString('state');
    await runAsSlash(interaction, client, autoplayCmd, state ? [state] : [], state || '');
  },
};
