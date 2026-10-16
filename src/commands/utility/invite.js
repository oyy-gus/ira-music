const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require('discord.js');
const config = require('../../config');
const { getEmoji } = require('../../config/emojis');

module.exports = {
  name: 'invite',
  description: 'Get an invite link to add the bot to your Discord server',
  aliases: ['inv', 'botinvite', 'link'],
  category: 'utility',
  cooldown: 3,
  async execute({ message, client }) {
    const botName = client.user?.username || 'Bot';
    const inviteEmoji = getEmoji('invite', client);

    const embed = new EmbedBuilder()
      .setTitle(`${inviteEmoji ? inviteEmoji + ' ' : ''}Invite ${botName} to Your Server`)
      .setDescription(
        `Click the button below to add **${botName}** to your Discord server!\n\n`
      )
      .addFields({ name: `${getEmoji('link', client)} Invite Link`, value: `[Click here to invite the bot](${config.discord.inviteUrl})` })
      .setThumbnail(client.user?.displayAvatarURL({ dynamic: true }))
      .setColor(0x5865F2)
      .setFooter({ text: `Thank you for choosing ${botName}!` });

    const btn = new ButtonBuilder()
      .setLabel('Invite Bot')
      .setStyle(ButtonStyle.Link)
      .setURL(config.discord.inviteUrl);

    if (inviteEmoji && inviteEmoji.includes(':')) {
      const emojiMatch = inviteEmoji.match(/:(\w+):(\d+)>/);
      if (emojiMatch) {
        btn.setEmoji({ name: emojiMatch[1], id: emojiMatch[2] });
      }
    }

    const row = new ActionRowBuilder().addComponents(btn);
    return message.reply({ embeds: [embed], components: [row] });
  },
};
