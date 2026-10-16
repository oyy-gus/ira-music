const { EmbedBuilder } = require('discord.js');
const userRepo = require('../../database/repositories/userRepository');
const { getEmoji } = require('../../config/emojis');

module.exports = {
  name: 'setabout',
  description: 'Set your personal profile About Me bio',
  aliases: ['setbio', 'about'],
  category: 'utility',
  cooldown: 5,
  async execute({ message, rawArgsString, prefix, client }) {
    const emoji = (key) => {
      const e = getEmoji(key, client);
      return e ? `${e} ` : '';
    };
    if (!rawArgsString) {
      const embed = new EmbedBuilder()
        .setTitle(`${emoji('error')}Missing Bio Text`)
        .setDescription(`Please provide a short description for your profile bio.\n\n**Example:** \`${prefix}setabout EDM Enthusiast & DJ Lover!\``)
        .setColor(0xED4245);
      return message.reply({ embeds: [embed] });
    }

    const visualText = rawArgsString.replace(/<a?:([a-zA-Z0-9_]+):[0-9]+>/g, ':$1:');
    if (visualText.length > 80 || rawArgsString.length > 300) {
      const embed = new EmbedBuilder()
        .setTitle(`${emoji('error')}Bio Too Long`)
        .setDescription('Your About Me description must be **80 characters or less** to fit on the profile card.')
        .setColor(0xED4245);
      return message.reply({ embeds: [embed] });
    }

    await userRepo.updateAboutMe(message.author.id, rawArgsString);

    const embed = new EmbedBuilder()
      .setTitle(`${emoji('success')}Profile Bio Updated`)
      .setDescription(`Your About Me bio has been set to:\n> ${rawArgsString}`)
      .setColor(0x57F287);
    return message.reply({ embeds: [embed] });
  },
};
