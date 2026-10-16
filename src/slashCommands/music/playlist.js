const { SlashCommandBuilder } = require('discord.js');
const playlistCmd = require('../../commands/music/playlist');
const { runAsSlash } = require('../../utils/commandBridge');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('playlist')
    .setDescription('Manage your custom saved playlists')
    .addStringOption((opt) =>
      opt
        .setName('action')
        .setDescription('Playlist action')
        .setRequired(true)
        .addChoices(
          { name: 'Load', value: 'load' },
          { name: 'Save', value: 'save' },
          { name: 'List', value: 'list' },
          { name: 'Delete', value: 'delete' }
        )
    )
    .addStringOption((opt) => opt.setName('name').setDescription('Playlist name'))
    .addStringOption((opt) => opt.setName('url').setDescription('Track URL (for save option)')),
  cooldown: 3,
  async execute(interaction, client) {
    const action = interaction.options.getString('action');
    const name = interaction.options.getString('name') || '';
    const url = interaction.options.getString('url') || '';
    const args = [action, name, url].filter(Boolean);
    await runAsSlash(interaction, client, playlistCmd, args, args.join(' '));
  },
};
