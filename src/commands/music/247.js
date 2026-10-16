const { EmbedBuilder } = require('discord.js');
const guildRepo = require('../../database/repositories/guildRepository');
const SessionPersistence = require('../../music/failover/SessionPersistence');
const TwentyFourSevenGuard = require('../../music/failover/TwentyFourSevenGuard');
const { sendAutoDelete } = require('../../utils/channelUtils');
const { getEmoji } = require('../../config/emojis');

module.exports = {
  name: '247',
  description: 'Toggle 24/7 mode to keep the bot in the voice channel permanently',
  aliases: ['24/7', '24-7', 'twentyfourseven', 'stay'],
  category: 'music',
  cooldown: 3,
  async execute({ message, args, client }) {
    const gEmoji = (key) => { const e = getEmoji(key, client); return e ? `${e} ` : ''; };
    const voiceChannel = message.member?.voice?.channel;
    if (!voiceChannel) {
      const embed = new EmbedBuilder()
        .setTitle(`${gEmoji('error')}Voice Channel Required`)
        .setDescription('You must join a voice channel to use the 24/7 command!')
        .setColor(0xED4245);
      return sendAutoDelete(message.reply({ embeds: [embed] }), 6000);
    }

    const guildSettings = await guildRepo.getGuildSettings(message.guild.id);
    const current247 = guildSettings?.musicSettings?.twentyFourSeven || false;

    const sub = args[0]?.toLowerCase();
    let newState = !current247;
    if (['on', 'enable', 'true', '1'].includes(sub)) newState = true;
    if (['off', 'disable', 'false', '0'].includes(sub)) newState = false;

    let player = client.lavalink?.players.get(message.guild.id);

    if (newState) {
      if (!player) {
        player = client.lavalink.createPlayer({
          guildId: message.guild.id,
          voiceChannelId: voiceChannel.id,
          textChannelId: message.channel.id,
          selfDeaf: true,
          selfMute: false,
          volume: guildSettings?.musicSettings?.defaultVolume || 100,
        });
        await player.connect();
      }

      player.set('twentyFourSeven', true);
      player.twentyFourSeven = true;

      await guildRepo.updateGuildSettings(message.guild.id, {
        'musicSettings.twentyFourSeven': true,
        'musicSettings.twentyFourSevenVC': voiceChannel.id,
        'musicSettings.twentyFourSevenTC': message.channel.id,
      });

      // Ensure flag is hydrated on player and cancel any stale reconnect
      TwentyFourSevenGuard.rehydrate247Flag(player);
      TwentyFourSevenGuard.cancelReconnect(message.guild.id);

      SessionPersistence.saveSnapshot(player, true);

      const embed = new EmbedBuilder()
        .setTitle(`${gEmoji('always_on')}24/7 Mode Enabled`)
        .setDescription(`24/7 mode is now **ENABLED**. The bot will stay in <#${voiceChannel.id}> permanently.`)
        .setColor(0x57F287);
      return sendAutoDelete(message.reply({ embeds: [embed] }), 12000);
    } else {
      if (player) {
        player.set('twentyFourSeven', false);
        player.twentyFourSeven = false;
        SessionPersistence.saveSnapshot(player, true);
      }

      // Cancel any pending 247 reconnect cycles immediately
      TwentyFourSevenGuard.cancelReconnect(message.guild.id);

      await guildRepo.updateGuildSettings(message.guild.id, {
        'musicSettings.twentyFourSeven': false,
        'musicSettings.twentyFourSevenVC': null,
        'musicSettings.twentyFourSevenTC': null,
      });

      const embed = new EmbedBuilder()
        .setTitle(`${gEmoji('always_on')}24/7 Mode Disabled`)
        .setDescription('24/7 mode is now **DISABLED**. The bot will leave the voice channel when playback finishes.')
        .setColor(0xED4245);
      return sendAutoDelete(message.reply({ embeds: [embed] }), 12000);
    }
  },
};
