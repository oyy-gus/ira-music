const logger = require('../../logger/logger');
const guildRepo = require('../../database/repositories/guildRepository');
const { ensureStageSpeaker } = require('../../utils/stageUtils');
const TwentyFourSevenGuard = require('../../music/failover/TwentyFourSevenGuard');

const emptyChannelTimers = new Map();

module.exports = {
  name: 'voiceStateUpdate',
  once: false,
  async execute(oldState, newState, client) {
    const guildId = oldState.guild.id;
    const botId = client.user?.id;

    // ==========================================
    // 1. HANDLE BOT'S OWN VOICE STATE CHANGES
    // ==========================================
    if (newState.member?.id === botId || oldState.member?.id === botId) {
      // Auto-promote bot to Speaker if in Stage channel or if suppressed
      if (newState.channelId) {
        ensureStageSpeaker(newState.guild, newState.channelId).catch(() => {});
      }

      // Case 1A: Bot moved to a different voice channel (by admin drag, etc.)
      if (newState.channelId && newState.channelId !== oldState.channelId) {
        logger.info(`[VoiceState] Bot moved to VC ${newState.channelId} in guild ${oldState.guild.name}`);

        const player = client.lavalink?.players.get(guildId);
        if (player) {
          player.voiceChannelId = newState.channelId;
          if (typeof player.set === 'function') {
            player.set('voiceChannelId', newState.channelId);
          }
        }

        // If 247 is active, update the saved VC so the guard knows where to reconnect
        const { is247 } = await TwentyFourSevenGuard.check247State(client, guildId).catch(() => ({ is247: false }));
        if (is247) {
          await guildRepo.updateGuildSettings(guildId, {
            'musicSettings.twentyFourSevenVC': newState.channelId,
          }).catch(() => {});
        }

        // Cancel any pending reconnect aimed at the old VC – we're already connected
        TwentyFourSevenGuard.cancelReconnect(guildId);
        return;
      }

      // Case 1B: Bot was disconnected from voice channel
      if (oldState.channelId && !newState.channelId) {
        logger.warn(`[VoiceState] Bot disconnected from VC in guild ${oldState.guild.name}`);

        const player = client.lavalink?.players.get(guildId);
        const { is247, vcId, tcId, guildSettings } = await TwentyFourSevenGuard.check247State(client, guildId)
          .catch(() => ({ is247: false, vcId: null, tcId: null, guildSettings: null }));

        const hasActiveTracks = Boolean(
          player && (player.playing || player.queue?.tracks?.length > 0 || player.queue?.current),
        );

        const targetVcId = oldState.channelId || vcId || player?.voiceChannelId;

        if ((is247 || hasActiveTracks) && targetVcId) {
          // Delegate reconnection to the guard (handles dedup + back-off)
          TwentyFourSevenGuard.scheduleReconnect(client, guildId, targetVcId, tcId, guildSettings);
        }
        return;
      }
    }

    // ==========================================
    // 2. HANDLE HUMAN MEMBERS LEAVING VC
    // ==========================================
    const player = client.lavalink?.players.get(guildId);
    if (!player || !player.voiceChannelId) return;

    const channel = client.channels.cache.get(player.voiceChannelId);
    if (!channel) return;

    const humanMembers = channel.members.filter((m) => !m.user.bot);

    if (humanMembers.size === 0) {
      const { is247 } = await TwentyFourSevenGuard.check247State(client, guildId)
        .catch(() => ({ is247: false }));

      if (is247) {
        // 24/7 mode: stay in VC even when empty
        return;
      }

      if (!emptyChannelTimers.has(guildId)) {
        logger.info(`[VoiceState] All users left VC in ${oldState.guild.name}. Starting 2-minute auto-leave timer...`);
        const timer = setTimeout(async () => {
          emptyChannelTimers.delete(guildId);
          const activePlayer = client.lavalink?.players.get(guildId);
          if (activePlayer) {
            const recheckChannel = client.channels.cache.get(activePlayer.voiceChannelId);
            if (recheckChannel && recheckChannel.members.filter((m) => !m.user.bot).size === 0) {
              const { is247: recheck247 } = await TwentyFourSevenGuard.check247State(client, guildId)
                .catch(() => ({ is247: false }));
              if (!recheck247) {
                logger.info(`[VoiceState] Auto-leaving empty VC in ${oldState.guild.name}`);
                await activePlayer.destroy();
              }
            }
          }
        }, 120000);

        emptyChannelTimers.set(guildId, timer);
      }
    } else {
      if (emptyChannelTimers.has(guildId)) {
        clearTimeout(emptyChannelTimers.get(guildId));
        emptyChannelTimers.delete(guildId);
      }
    }
  },
};
