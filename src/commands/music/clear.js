const { EmbedBuilder } = require('discord.js');
const SessionPersistence = require('../../music/failover/SessionPersistence');
const { sendAutoDelete } = require('../../utils/channelUtils');
const { getEmoji } = require('../../config/emojis');

module.exports = {
  name: 'clear',
  description: 'Clear all upcoming tracks from the queue',
  aliases: ['clearqueue', 'cq'],
  category: 'music',
  cooldown: 2,
  async execute({ message }) {
    const client = message.client;
    const gEmoji = (key) => { const e = getEmoji(key, client); return e ? `${e} ` : ''; };
    const player = client.lavalink?.players.get(message.guild.id);
    if (!player || !player.connected || player.queue.tracks.length === 0) {
      const embed = new EmbedBuilder()
        .setTitle(`${gEmoji('error')}Queue Empty`)
        .setDescription('There are no upcoming tracks in the queue to clear.')
        .setColor(0xED4245);
      return sendAutoDelete(message.reply({ embeds: [embed] }), 6000);
    }

    const clearedCount = player.queue.tracks.length;
    player.queue.tracks = [];
    SessionPersistence.saveSnapshot(player, true);

    const embed = new EmbedBuilder()
      .setTitle(`${gEmoji('clear')}Queue Cleared`)
      .setDescription(`Cleared **${clearedCount} tracks** from the queue. Currently playing track remains.`)
      .setColor(0x57F287);
    return sendAutoDelete(message.reply({ embeds: [embed] }), 12000);
  },
};
