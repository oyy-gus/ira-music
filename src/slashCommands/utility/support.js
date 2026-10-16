const { SlashCommandBuilder } = require('discord.js');
const supportCmd = require('../../commands/utility/support');
const { runAsSlash } = require('../../utils/commandBridge');

module.exports = {
  data: new SlashCommandBuilder().setName('support').setDescription('Get bot support server link and documentation'),
  cooldown: 3,
  async execute(interaction, client) {
    await runAsSlash(interaction, client, supportCmd);
  },
};
