const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require('discord.js');
const { getEmoji } = require('../../config/emojis');

module.exports = {
  name: 'support',
  description: 'Get the link to join the official support server',
  aliases: ['supportserver', 'server', 'community'],
  category: 'utility',
  cooldown: 3,
  async execute({ message, client }) {
    const supportUrl = 'https://discord.gg/QTxGBmVrv8';
    const botName = client.user?.username || 'Bot';

    const embed = new EmbedBuilder()
      .setTitle(`${getEmoji('support', client)} Join ${botName} Support Server`)
      .setDescription(
        `Need help, found a bug, or want to suggest new features?\nJoin our official support server and community!`
      )
      .addFields(
        {
          name: `${getEmoji('tools', client)} What you can find in our Support Server:`,
          value: [
            '• **Customer & Technical Support** for bot issues',
            '• **Bug Reports & Feature Requests**',
            '• **Latest Bot Updates & Announcements**',
            '• **Community & Music Lovers Hangout**',
          ].join('\n'),
          inline: false,
        },
        {
          name: `${getEmoji('link', client)} Support Server Link`,
          value: `[Click here to join Support Server](${supportUrl})`,
          inline: false,
        }
      )
      .setThumbnail(client.user?.displayAvatarURL({ extension: 'png', size: 128 }))
      .setColor(0x5865F2)
      .setFooter({ text: `${botName} Support & Community` });

    const btn = new ButtonBuilder()
      .setLabel('Join Support Server')
      .setStyle(ButtonStyle.Link)
      .setURL(supportUrl);
    const supportEmoji = getEmoji('support', client);
    if (supportEmoji) btn.setEmoji(supportEmoji);

    const row = new ActionRowBuilder().addComponents(btn);

    return message.reply({ embeds: [embed], components: [row] });
  },
};
