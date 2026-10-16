const { SlashCommandBuilder } = require('discord.js');
const leaderboardCmd = require('../../commands/music/leaderboard');
const { runAsSlash } = require('../../utils/commandBridge');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('leaderboard')
    .setDescription('View global top listeners, global top servers, or current server rankings')
    .addStringOption((opt) =>
      opt
        .setName('type')
        .setDescription('Ranking category')
        .addChoices(
          { name: 'Global Top Users', value: 'global' },
          { name: 'Global Top Servers', value: 'servers' },
          { name: 'Server Top Users', value: 'server' }
        )
    ),
  cooldown: 5,
  async execute(interaction, client) {
    const type = interaction.options.getString('type') || 'global';
    await runAsSlash(interaction, client, leaderboardCmd, [type]);
  },
};
