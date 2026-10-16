const { EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const guildRepo = require('../../database/repositories/guildRepository');
const config = require('../../config');
const { getEmoji } = require('../../config/emojis');

module.exports = {
  name: 'prefix',
  description: 'View or set the custom prefix for this server.',
  category: 'utility',
  aliases: ['setprefix'],
  userPermissions: [PermissionFlagsBits.ManageGuild],
  async execute({ message, args, client }) {
    const emoji = (key) => {
      const e = getEmoji(key, client);
      return e ? `${e} ` : '';
    };
    const guildSettings = await guildRepo.getGuildSettings(message.guild.id);
    const currentPrefix = guildSettings?.prefix || config.discord.defaultPrefix;

    if (!args || args.length === 0) {
      const embed = new EmbedBuilder()
        .setTitle(`${emoji('prefix')}Server Prefix`)
        .setDescription(`The current prefix for this server is: \`${currentPrefix}\`\n\nTo change it, use: \`${currentPrefix}prefix <new_prefix>\``)
        .setColor(0x5865F2);
      return message.reply({ embeds: [embed] });
    }

    const newPrefix = args[0].trim();
    if (newPrefix.length > 5) {
      const embed = new EmbedBuilder()
        .setTitle(`${emoji('error')}Invalid Prefix`)
        .setDescription('Prefix length cannot exceed 5 characters.')
        .setColor(0xED4245);
      return message.reply({ embeds: [embed] });
    }

    await guildRepo.updateGuildSettings(message.guild.id, { prefix: newPrefix });

    const embed = new EmbedBuilder()
      .setTitle(`${emoji('success')}Prefix Updated`)
      .setDescription(`The bot prefix for this server has been set to: \`${newPrefix}\``)
      .setColor(0x57F287);
    return message.reply({ embeds: [embed] });
  },
};
