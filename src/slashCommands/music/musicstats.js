const { SlashCommandBuilder } = require('discord.js');
const musicstatsCmd = require('../../commands/music/musicstats');
const { runAsSlash } = require('../../utils/commandBridge');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('musicstats')
    .setDescription('View detailed music listening analytics, top tracks & companions')
    .addUserOption((opt) => opt.setName('user').setDescription('Target user')),
  cooldown: 5,
  async execute(interaction, client) {
    const user = interaction.options.getUser('user');
    await runAsSlash(interaction, client, musicstatsCmd, user ? [user.id] : [], user ? user.id : '');
  },
};
