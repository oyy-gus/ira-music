const { SlashCommandBuilder } = require('discord.js');
const seekCmd = require('../../commands/music/seek');
const { runAsSlash } = require('../../utils/commandBridge');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('seek')
    .setDescription('Seek to a timestamp in current playing track (e.g. 1:30 or 90)')
    .addStringOption((opt) => opt.setName('timestamp').setDescription('Timestamp (e.g. 1:30 or 90)').setRequired(true)),
  cooldown: 3,
  async execute(interaction, client) {
    const ts = interaction.options.getString('timestamp');
    await runAsSlash(interaction, client, seekCmd, [ts], ts);
  },
};
