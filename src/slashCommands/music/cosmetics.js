const { SlashCommandBuilder } = require('discord.js');
const cosmeticsCmd = require('../../commands/music/cosmetics');
const { runAsSlash } = require('../../utils/commandBridge');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('cosmetics')
    .setDescription('View unlocked profile cosmetics or equip a cosmetic')
    .addStringOption((opt) => opt.setName('equip').setDescription('Cosmetic ID to equip (e.g. frame_gold)')),
  cooldown: 5,
  async execute(interaction, client) {
    const equipId = interaction.options.getString('equip');
    await runAsSlash(interaction, client, cosmeticsCmd, equipId ? [equipId] : []);
  },
};
