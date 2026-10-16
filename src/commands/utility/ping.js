const { EmbedBuilder } = require('discord.js');
const { getEmoji } = require('../../config/emojis');

module.exports = {
  name: 'ping',
  description: 'Check bot latency and API responsiveness',
  aliases: ['latency'],
  category: 'utility',
  cooldown: 3,
  async execute({ message, client }) {
    const emoji = (key) => {
      const e = getEmoji(key, client);
      return e ? `${e} ` : '';
    };

    const pingEmbed = new EmbedBuilder()
      .setTitle(`${emoji('reconnect')}Pinging...`)
      .setColor(0x5865F2);

    const sent = await message.reply({ embeds: [pingEmbed] });
    const roundtrip = sent.createdTimestamp - message.createdTimestamp;
    const wsPing = Math.round(client.ws.ping);

    const resultEmbed = new EmbedBuilder()
      .setTitle(`${emoji('ping')}Pong!`)
      .addFields(
        { name: 'Roundtrip Latency', value: `\`${roundtrip}ms\``, inline: true },
        { name: 'WebSocket Latency', value: `\`${wsPing}ms\``, inline: true }
      )
      .setColor(0x57F287);

    return sent.edit({ embeds: [resultEmbed] });
  },
};
