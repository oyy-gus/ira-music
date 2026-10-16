const { SlashCommandBuilder } = require('discord.js');
const queueCmd = require('../../commands/music/queue');
const { runAsSlash } = require('../../utils/commandBridge');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('queue')
    .setDescription('View current music queue and upcoming tracks')
    .addIntegerOption((opt) => opt.setName('page').setDescription('Queue page number')),
  cooldown: 3,
  async execute(interaction, client) {
    const page = interaction.options.getInteger('page');
    await runAsSlash(interaction, client, queueCmd, page ? [String(page)] : [], page ? String(page) : '');
  },
};
