const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const stopCmd = require('../../commands/music/stop');
const { runAsSlash } = require('../../utils/commandBridge');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('stop')
    .setDescription('Stop playback, clear queue, and leave voice channel')
    .setDefaultMemberPermissions(PermissionFlagsBits.Connect),
  cooldown: 2,
  async execute(interaction, client) {
    await runAsSlash(interaction, client, stopCmd);
  },
};
