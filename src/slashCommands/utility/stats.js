const { SlashCommandBuilder } = require('discord.js');
const statsCmd = require('../../commands/utility/stats');
const { runAsSlash } = require('../../utils/commandBridge');

module.exports = {
  data: new SlashCommandBuilder().setName('stats').setDescription('Show bot statistics, uptime and server count'),
  cooldown: 5,
  async execute(interaction, client) {
    await runAsSlash(interaction, client, statsCmd);
  },
};
