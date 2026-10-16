const { EmbedBuilder } = require('discord.js');
const userRepo = require('../../database/repositories/userRepository');
const { sendAutoDelete } = require('../../utils/channelUtils');
const { getEmoji } = require('../../config/emojis');

module.exports = {
  name: 'setprivacy',
  description: 'Set your profile visibility to public or private',
  aliases: ['privacy', 'profileprivacy'],
  category: 'utility',
  cooldown: 5,
  async execute({ message, args, client, prefix }) {
    const gEmoji = (key) => { const e = getEmoji(key, client); return e ? `${e} ` : ''; };

    const input = (args[0] || '').toLowerCase();
    if (!['public', 'private'].includes(input)) {
      const embed = new EmbedBuilder()
        .setTitle(`${gEmoji('error')}Invalid Option`)
        .setDescription(
          `Please specify \`public\` or \`private\`.\n\n` +
          `**Usage:**\n` +
          `\`${prefix}setprivacy public\` — Anyone can view your profile\n` +
          `\`${prefix}setprivacy private\` — Only you can view your profile`
        )
        .setColor(0xED4245);
      return sendAutoDelete(message.reply({ embeds: [embed] }), 8000);
    }

    const isPrivate = input === 'private';

    try {
      await userRepo.setProfilePrivacy(message.author.id, isPrivate);

      const embed = new EmbedBuilder()
        .setTitle(`${gEmoji('settings')}Profile Privacy Updated`)
        .setDescription(
          isPrivate
            ? `🔒 Your profile is now **Private**.\nOnly you can view your own profile.`
            : `🌐 Your profile is now **Public**.\nAnyone can view your profile.`
        )
        .setColor(isPrivate ? 0xFEE75C : 0x57F287)
        .setFooter({ text: `Changed by ${message.author.tag}` });

      return message.reply({ embeds: [embed] });
    } catch (err) {
      const embed = new EmbedBuilder()
        .setTitle(`${gEmoji('error')}Error`)
        .setDescription('Failed to update your profile privacy settings. Please try again.')
        .setColor(0xED4245);
      return sendAutoDelete(message.reply({ embeds: [embed] }), 6000);
    }
  },
};
