const { SlashCommandBuilder } = require('discord.js');
const achievementsCmd = require('../../commands/music/achievements');
const { runAsSlash } = require('../../utils/commandBridge');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('achievements')
    .setDescription('View unlocked and locked achievements collection')
    .addUserOption((opt) => opt.setName('user').setDescription('Target user')),
  cooldown: 5,
  async execute(interaction, client) {
    const user = interaction.options.getUser('user');
    await runAsSlash(interaction, client, achievementsCmd, user ? [user.id] : [], user ? user.id : '');
  },
};
