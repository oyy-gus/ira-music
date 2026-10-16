const { ChannelType } = require('discord.js');
const logger = require('../logger/logger');

/**
 * Ensures the bot becomes a Speaker in Stage channels (unsuppresses the bot)
 * @param {Object} guild - Discord Guild instance
 * @param {string} channelId - Voice/Stage channel ID
 */
const ensureStageSpeaker = async (guild, channelId) => {
  if (!guild || !channelId) return;

  try {
    let channel = guild.channels.cache.get(channelId);
    if (!channel && typeof guild.channels.fetch === 'function') {
      channel = await guild.channels.fetch(channelId).catch(() => null);
    }

    if (!channel) return;

    // Check if channel is a Stage channel (type 13 / GuildStageVoice)
    const isStage = channel.type === ChannelType.GuildStageVoice || channel.type === 13;
    if (!isStage) return;

    const me = guild.members.me || (typeof guild.members.fetchMe === 'function' ? await guild.members.fetchMe().catch(() => null) : null);
    if (!me || !me.voice) return;

    // If bot is suppressed (Audience member in Stage channel), unsuppress it to become Speaker
    if (me.voice.suppress) {
      try {
        await me.voice.setSuppressed(false);
        logger.info(`[StageUtils] Promoted bot to Speaker in Stage Channel "${channel.name}" (${guild.name})`);
      } catch (err) {
        logger.warn(`[StageUtils] Direct setSuppressed(false) failed in "${channel.name}" (${guild.name}): ${err.message}. Requesting to speak...`);
        try {
          await me.voice.setRequestToSpeak(true);
        } catch (_) {}
      }
    }
  } catch (error) {
    logger.debug(`[StageUtils] Error ensuring stage speaker for guild ${guild.id}: ${error.message}`);
  }
};

module.exports = {
  ensureStageSpeaker,
};
