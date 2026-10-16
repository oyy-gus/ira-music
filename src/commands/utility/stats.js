const { EmbedBuilder } = require('discord.js');
const mongoose = require('mongoose');
const { getEmoji } = require('../../config/emojis');

module.exports = {
  name: 'stats',
  description: 'View global bot analytics, server stats, and node status',
  aliases: ['status', 'botinfo', 'info'],
  category: 'utility',
  cooldown: 5,
  async execute({ message, client }) {
    const emoji = (key) => {
      const e = getEmoji(key, client);
      return e ? `${e} ` : '';
    };

    const guildsCount = client.guilds.cache.size;
    const activePlayers = client.lavalink?.players.size || 0;

    const memory = process.memoryUsage();
    const memoryUsageMb = (memory.rss / 1024 / 1024).toFixed(1);

    const uptimeSeconds = Math.floor(process.uptime());
    const days = Math.floor(uptimeSeconds / 86400);
    const hours = Math.floor((uptimeSeconds % 86400) / 3600);
    const mins = Math.floor((uptimeSeconds % 3600) / 60);
    const uptimeStr = `${days}d ${hours}h ${mins}m`;

    const nodes = client.lavalink?.nodeManager.nodes || new Map();
    const nodesList = Array.from(nodes.values()).map(n => {
      const state = n.connected ? `${emoji('connected')}Connected` : `${emoji('disconnect')}Disconnected`;
      return `• **${n.id}**: ${state}`;
    }).join('\n') || 'No nodes connected';

    const dbState = mongoose.connection.readyState === 1 ? `${emoji('connected')}Connected` : `${emoji('disconnect')}Disconnected`;

    const embed = new EmbedBuilder()
      .setTitle(`${emoji('global')}Global Music Platform Analytics`)
      .addFields(
        { name: `${emoji('server')}Servers`, value: `\`${guildsCount}\``, inline: true },
        { name: `${emoji('music')}Active Players`, value: `\`${activePlayers}\``, inline: true },
        { name: `${emoji('uptime')}Uptime`, value: `\`${uptimeStr}\``, inline: true },
        { name: `${emoji('memory')}Memory Usage`, value: `\`${memoryUsageMb} MB\``, inline: true },
        { name: `${emoji('database')}Database`, value: dbState, inline: true },
        { name: `${emoji('ping')}Discord Ping`, value: `\`${client.ws.ping}ms\``, inline: true },
        { name: `${emoji('lavalink')}Lavalink Nodes`, value: nodesList, inline: false }
      )
      .setColor(0x5865F2);

    return message.reply({ embeds: [embed] });
  },
};
