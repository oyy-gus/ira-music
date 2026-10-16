const { SlashCommandBuilder } = require('discord.js');
const setaboutCmd = require('../../commands/utility/setabout');
const { runAsSlash } = require('../../utils/commandBridge');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('setabout')
    .setDescription('Set your personal profile About Me bio')
    .addStringOption((opt) =>
      opt
        .setName('text')
        .setDescription('Your About Me description (max 80 chars)')
        .setRequired(true)
    ),
  cooldown: 5,
  async execute(interaction, client) {
    const text = interaction.options.getString('text') || '';
    await runAsSlash(interaction, client, setaboutCmd, [text], text);
  },
};
