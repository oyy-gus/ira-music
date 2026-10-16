const { SlashCommandBuilder } = require('discord.js');
const profileCmd = require('../../commands/music/profile');
const { runAsSlash } = require('../../utils/commandBridge');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('profile')
    .setDescription('View music listening profile and stats')
    .addUserOption((opt) => opt.setName('user').setDescription('Target user')),
  cooldown: 5,
  async execute(interaction, client) {
    const user = interaction.options.getUser('user');
    await runAsSlash(interaction, client, profileCmd, user ? [user.id] : [], user ? user.id : '');
  },
};
