const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const prefixCmd = require('../../commands/utility/prefix');
const { runAsSlash } = require('../../utils/commandBridge');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('prefix')
    .setDescription('View or change the bot command prefix for this server')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addStringOption((opt) => opt.setName('new_prefix').setDescription('New prefix to set (max 5 chars)')),
  cooldown: 5,
  async execute(interaction, client) {
    const newPrefix = interaction.options.getString('new_prefix');
    await runAsSlash(interaction, client, prefixCmd, newPrefix ? [newPrefix] : [], newPrefix || '');
  },
};
