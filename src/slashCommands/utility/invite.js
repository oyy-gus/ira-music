const { SlashCommandBuilder } = require('discord.js');
const inviteCmd = require('../../commands/utility/invite');
const { runAsSlash } = require('../../utils/commandBridge');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('invite')
    .setDescription('Get invite link to add the bot to your Discord server'),
  cooldown: 3,
  async execute(interaction, client) {
    await runAsSlash(interaction, client, inviteCmd);
  },
};
