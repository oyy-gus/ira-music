const { SlashCommandBuilder } = require('discord.js');
const helpCmd = require('../../commands/utility/help');
const { runAsSlash } = require('../../utils/commandBridge');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('help')
    .setDescription('Show help menu and command list')
    .addStringOption((opt) => opt.setName('command').setDescription('Specific command name for detailed help')),
  cooldown: 3,
  async execute(interaction, client) {
    const cmd = interaction.options.getString('command');
    await runAsSlash(interaction, client, helpCmd, cmd ? [cmd] : [], cmd || '');
  },
};
