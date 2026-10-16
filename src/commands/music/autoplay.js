const { EmbedBuilder } = require('discord.js');
const RecommendationEngine = require('../../music/autoplay/recommendationEngine');
const SessionPersistence = require('../../music/failover/SessionPersistence');
const logger = require('../../logger/logger');
const { getEmoji } = require('../../config/emojis');

module.exports = {
  name: 'autoplay',
  description: 'Toggle standard autoplay mode (*autoplay on / *autoplay off)',
  aliases: ['auto'],
  category: 'music',
  cooldown: 2,
  async execute({ message, args, client }) {
    const gEmoji = (key) => { const e = getEmoji(key, client); return e ? `${e} ` : ''; };
    const player = client.lavalink?.players.get(message.guild.id);
    if (!player || !player.connected) {
      const embed = new EmbedBuilder()
        .setTitle(`${gEmoji('error')}Session Error`)
        .setDescription('No active music session in this server.')
        .setColor(0xED4245);
      const msg = await message.reply({ embeds: [embed] });
      setTimeout(() => msg.delete().catch(() => {}), 6000);
      return;
    }

    if (!message.member.voice.channel || message.member.voice.channel.id !== player.voiceChannelId) {
      const embed = new EmbedBuilder()
        .setTitle(`${gEmoji('error')}Voice Channel Mismatch`)
        .setDescription('You must be in the same voice channel as the bot to toggle autoplay!')
        .setColor(0xED4245);
      const msg = await message.reply({ embeds: [embed] });
      setTimeout(() => msg.delete().catch(() => {}), 6000);
      return;
    }

    // ── Determine new autoplay state ──────────────────────────────────────────
    const subCommand = args[0] ? args[0].toLowerCase() : null;
    RecommendationEngine.ensurePlayerData(player);
    const currentAutoplay = !!(
      player.data.get('autoplay') ||
      (typeof player.get === 'function' && player.get('autoplay'))
    );
    let newState = !currentAutoplay;
    if (subCommand === 'on'  || subCommand === 'enable')  newState = true;
    if (subCommand === 'off' || subCommand === 'disable') newState = false;

    // ── Save autoplay state ───────────────────────────────────────────────────
    player.data.set('autoplay', newState);
    if (typeof player.set === 'function') { try { player.set('autoplay', newState); } catch {} }

    // ── Store current track identifier so recommendation engine can find it ───
    const currentTrack = player.queue?.current || player.current;
    if (currentTrack?.info?.identifier) {
      player.data.set('identifier', currentTrack.info.identifier);
      if (typeof player.set === 'function') {
        try { player.set('identifier', currentTrack.info.identifier); } catch {}
      }
    }
    if (currentTrack?.userData) {
      player.data.set('requester', currentTrack.userData);
    }

    SessionPersistence.saveSnapshot(player, true);

    // ── Send embed immediately (always visible, no delay) ─────────────────────
    const embed = new EmbedBuilder()
      .setTitle(`${gEmoji('autoplay')}Autoplay ${newState ? 'Enabled' : 'Disabled'}`)
      .setDescription(`Standard Autoplay mode has been **${newState ? 'ENABLED' : 'DISABLED'}**.`)
      .setColor(newState ? 0x57F287 : 0xED4245);

    const replyMsg = await message.reply({ embeds: [embed] });

    // ── Pre-fetch next track in background (if just enabled and queue empty) ───
    if (newState && currentTrack && player.queue.tracks.length === 0) {
      RecommendationEngine.getRecommendation(player, currentTrack)
        .then(async (recTrack) => {
          if (!recTrack) {
            logger.warn(`[Autoplay] getRecommendation returned null — guild ${player.guildId}`);
            return;
          }

          // Add track to queue
          recTrack.userData = { requesterTag: 'Autoplay', requesterId: client.user.id };
          player.queue.add(recTrack);
          SessionPersistence.saveSnapshot(player, true);
          logger.info(`[Autoplay] Queued next track: "${recTrack.info?.title}" — guild ${player.guildId}`);

          // Start playback if idle
          if (!player.playing && !player.paused && typeof player.play === 'function') {
            await player.play();
          }

          // Update embed to show the queued track
          try {
            const updatedEmbed = new EmbedBuilder()
              .setTitle(`${gEmoji('autoplay')}Autoplay Enabled`)
              .setDescription(
                `Standard Autoplay mode has been **ENABLED**.\n\n${gEmoji('autoplay')} **Next Up:** [${recTrack.info.title}](${recTrack.info.uri || ''})`
              )
              .setColor(0x57F287);
            await replyMsg.edit({ embeds: [updatedEmbed] });
          } catch (editErr) {
            logger.debug(`[Autoplay] Could not edit reply embed: ${editErr.message}`);
          }
        })
        .catch((err) => {
          logger.error(`[Autoplay] Pre-fetch error — guild ${player.guildId}: ${err.message}`);
        });
    }

    // Auto-delete reply after 15 seconds
    setTimeout(() => replyMsg.delete().catch(() => {}), 15000);
  },
};
