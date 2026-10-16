const { SlashCommandBuilder } = require('discord.js');
const setprivacyCmd = require('../../commands/utility/setprivacy');
const { runAsSlash } = require('../../utils/commandBridge');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('setprivacy')
    .setDescription('Set your profile visibility to public or private')
    .addStringOption((opt) =>
      opt
        .setName('visibility')
        .setDescription('Choose who can see your profile')
        .setRequired(true)
        .addChoices(
          { name: '🌐 Public — Anyone can view your profile', value: 'public' },
          { name: '🔒 Private — Only you can view your profile', value: 'private' }
        )
    ),
  cooldown: 5,
  async execute(interaction, client) {
    const visibility = interaction.options.getString('visibility') || 'public';
    await runAsSlash(interaction, client, setprivacyCmd, [visibility], visibility);
  },
};
