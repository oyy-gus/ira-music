const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const mode247Cmd = require('../../commands/music/247');
const { runAsSlash } = require('../../utils/commandBridge');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('247')
    .setDescription('Toggle 24/7 mode to keep bot in voice channel permanently')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addStringOption((opt) =>
      opt.setName('state').setDescription('Toggle mode').addChoices({ name: 'On', value: 'on' }, { name: 'Off', value: 'off' })
    ),
  cooldown: 3,
  async execute(interaction, client) {
    const state = interaction.options.getString('state');
    await runAsSlash(interaction, client, mode247Cmd, state ? [state] : [], state || '');
  },
};
