const { SlashCommandBuilder } = require('discord.js');
const pingCmd = require('../../commands/utility/ping');
const { runAsSlash } = require('../../utils/commandBridge');

module.exports = {
  data: new SlashCommandBuilder().setName('ping').setDescription('Check bot latency and API responsiveness'),
  cooldown: 3,
  async execute(interaction, client) {
    await runAsSlash(interaction, client, pingCmd);
  },
};
