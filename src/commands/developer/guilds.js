const { EmbedBuilder } = require('discord.js');
const { getEmoji } = require('../../config/emojis');

module.exports = {
  name: 'guilds',
  description: 'List all servers the bot is currently in',
  aliases: ['servers', 'guildlist'],
  category: 'developer',
  ownerOnly: true,
  cooldown: 0,
  async execute({ message, client }) {
    const guilds = Array.from(client.guilds.cache.values());
    const totalMembers = guilds.reduce((acc, g) => acc + g.memberCount, 0);

    const guildList = guilds.map((g, i) => `${i + 1}. **${g.name}** (\`${g.id}\`) - ${g.memberCount} members`);

    // Split list into chunks if too long for one embed field
    const chunkSize = 15;
    const pages = [];
    for (let i = 0; i < guildList.length; i += chunkSize) {
      pages.push(guildList.slice(i, i + chunkSize).join('\n'));
    }

    const serverEmoji = getEmoji('server', client);
    const embed = new EmbedBuilder()
      .setTitle(`${serverEmoji ? `${serverEmoji} ` : ''}Server List (${guilds.length} Guilds, ${totalMembers} Users)`)
      .setDescription(pages[0] || 'Bot is not in any servers.')
      .setColor(0x5865F2)
      .setFooter({ text: `Page 1 of ${pages.length || 1} • Client: ${client.user.tag}` })
      .setTimestamp();

    return message.reply({ embeds: [embed] });
  },
};
