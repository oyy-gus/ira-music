const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const settingsCmd = require('../../commands/utility/settings');
const { runAsSlash } = require('../../utils/commandBridge');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('settings')
    .setDescription('View or manage server music settings')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addStringOption((opt) => opt.setName('setting').setDescription('Setting key to view or change'))
    .addStringOption((opt) => opt.setName('value').setDescription('New value to set')),
  cooldown: 5,
  async execute(interaction, client) {
    const setting = interaction.options.getString('setting');
    const value = interaction.options.getString('value');
    const args = [setting, value].filter(Boolean);
    await runAsSlash(interaction, client, settingsCmd, args, args.join(' '));
  },
};
