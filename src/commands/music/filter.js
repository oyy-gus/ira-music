const { EmbedBuilder } = require('discord.js');
const SessionPersistence = require('../../music/failover/SessionPersistence');
const { sendAutoDelete } = require('../../utils/channelUtils');
const { getEmoji } = require('../../config/emojis');

module.exports = {
  name: 'filter',
  description: 'Apply audio filters (bassboost, nightcore, vaporwave, 8d, pop, reset)',
  aliases: ['filters', 'eq'],
  category: 'music',
  cooldown: 3,
  async execute({ message, args, prefix }) {
    const client = message.client;
    const gEmoji = (key) => { const e = getEmoji(key, client); return e ? `${e} ` : ''; };
    const player = client.lavalink?.players.get(message.guild.id);
    if (!player || !player.connected || !player.queue.current) {
      const embed = new EmbedBuilder()
        .setTitle(`${gEmoji('error')}Session Error`)
        .setDescription('No active track playing to apply filters.')
        .setColor(0xED4245);
      return sendAutoDelete(message.reply({ embeds: [embed] }), 6000);
    }

    if (!message.member.voice.channel || message.member.voice.channel.id !== player.voiceChannelId) {
      const embed = new EmbedBuilder()
        .setTitle(`${gEmoji('error')}Voice Channel Mismatch`)
        .setDescription('You must be in the same voice channel as the bot to change filters!')
        .setColor(0xED4245);
      return sendAutoDelete(message.reply({ embeds: [embed] }), 6000);
    }

    const filterType = args[0] ? args[0].toLowerCase() : null;
    const availableFilters = ['bassboost', 'nightcore', 'vaporwave', '8d', 'pop', 'clear', 'reset', 'off'];

    if (!filterType || !availableFilters.includes(filterType)) {
      const embed = new EmbedBuilder()
        .setTitle(`${gEmoji('equalizer')}Audio Filters`)
        .setDescription(`Select a filter to apply:\n\n` +
          `• \`${prefix}filter bassboost\` — Boost low-frequency bass\n` +
          `• \`${prefix}filter nightcore\` — Speed up pitch & tempo\n` +
          `• \`${prefix}filter vaporwave\` — Slow down pitch & tempo\n` +
          `• \`${prefix}filter 8d\` — 3D rotating audio effect\n` +
          `• \`${prefix}filter pop\` — Pop equalizer preset\n` +
          `• \`${prefix}filter reset\` — Clear all active audio filters`
        )
        .setColor(0x5865F2);
      return sendAutoDelete(message.reply({ embeds: [embed] }), 15000);
    }

    try {
      if (filterType === 'reset' || filterType === 'clear' || filterType === 'off') {
        if (player.filterManager) {
          await player.filterManager.resetFilters();
        }
        SessionPersistence.saveSnapshot(player, true);
        const embed = new EmbedBuilder()
          .setTitle(`${gEmoji('equalizer')}Audio Filters Reset`)
          .setDescription('All audio filters have been **cleared**.')
          .setColor(0x57F287);
        return sendAutoDelete(message.reply({ embeds: [embed] }), 12000);
      }

      if (filterType === 'bassboost') {
        if (typeof player.filterManager.setEQPreset === 'function') {
          await player.filterManager.setEQPreset('BassboostHigh');
        } else {
          await player.filterManager.setEQ([
            { band: 0, gain: 0.25 },
            { band: 1, gain: 0.20 },
            { band: 2, gain: 0.15 },
            { band: 3, gain: 0.10 },
          ]);
        }
      } else if (filterType === 'nightcore') {
        await player.filterManager.toggleNightcore();
      } else if (filterType === 'vaporwave') {
        await player.filterManager.toggleVaporwave();
      } else if (filterType === '8d') {
        await player.filterManager.toggleRotation(0.2);
      } else if (filterType === 'pop') {
        if (typeof player.filterManager.setEQPreset === 'function') {
          await player.filterManager.setEQPreset('Pop');
        } else {
          await player.filterManager.setEQ([
            { band: 0, gain: -0.05 },
            { band: 1, gain: 0.10 },
            { band: 2, gain: 0.20 },
            { band: 3, gain: 0.25 },
          ]);
        }
      }

      SessionPersistence.saveSnapshot(player, true);

      const embed = new EmbedBuilder()
        .setTitle(`${gEmoji('equalizer')}Filter Applied`)
        .setDescription(`Audio filter set to **${filterType.toUpperCase()}**.`)
        .setColor(0x57F287);
      return sendAutoDelete(message.reply({ embeds: [embed] }), 12000);
    } catch (err) {
      const embed = new EmbedBuilder()
        .setTitle(`${gEmoji('error')}Filter Error`)
        .setDescription(`Failed to apply filter: ${err.message}`)
        .setColor(0xED4245);
      return sendAutoDelete(message.reply({ embeds: [embed] }), 6000);
    }
  },
};
