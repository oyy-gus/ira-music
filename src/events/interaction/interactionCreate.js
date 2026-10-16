const { handleButtonInteraction } = require('../../handlers/interactionHandler');
const { handleSlashInteraction } = require('../../handlers/slashHandler');

module.exports = {
  name: 'interactionCreate',
  once: false,
  async execute(interaction, client) {
    if (interaction.isChatInputCommand()) {
      await handleSlashInteraction(interaction, client);
      return;
    }
    if (interaction.isButton()) {
      await handleButtonInteraction(interaction, client);
    }
  },
};
