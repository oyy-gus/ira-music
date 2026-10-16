const { SlashCommandBuilder } = require('discord.js');
const levelCmd = require('../../commands/music/level');
const { runAsSlash } = require('../../utils/commandBridge');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('level')
    .setDescription('View player level, XP progress bar, and rank card with Canvas')
    .addUserOption((opt) => opt.setName('user').setDescription('Target user')),
  cooldown: 5,
  async execute(interaction, client) {
    const user = interaction.options.getUser('user');
    await runAsSlash(interaction, client, levelCmd, user ? [user.id] : [], user ? user.id : '');
  },
};
