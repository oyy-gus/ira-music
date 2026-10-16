const { SlashCommandBuilder } = require('discord.js');
const nodesCmd = require('../../commands/utility/nodes');
const { runAsSlash } = require('../../utils/commandBridge');

module.exports = {
  data: new SlashCommandBuilder().setName('nodes').setDescription('Show Lavalink node status and health information'),
  cooldown: 5,
  async execute(interaction, client) {
    await runAsSlash(interaction, client, nodesCmd);
  },
};
