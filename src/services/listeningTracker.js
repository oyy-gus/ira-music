/**
 * Listening Tracker Service
 * Single source of truth for VC Presence listening time calculation.
 * Tracks human users in the same VC as Ira Music and grants Listening Time, XP, and Level progress.
 */

const { AttachmentBuilder } = require('discord.js');
const userRepo = require('../database/repositories/userRepository');
const guildRepo = require('../database/repositories/guildRepository');
const { AchievementEngine } = require('../cloud/achievementEngine');
const ListeningStreak = require('../cloud/listeningStreak');
const { generateLevelUpCard } = require('../utils/levelUpCanvas');
const { getCosmeticById } = require('../config/cosmetics');
const logger = require('../logger/logger');

class ListeningTracker {
  constructor() {
    this.client = null;
    this.intervalTimer = null;
    this.lastTickMap = new Map(); // key: guildId, val: timestamp
    this.intervalMs = 30000; // Check every 30 seconds
  }

  /**
   * Start periodic tracking tick loop
   */
  start(client) {
    this.client = client;
    if (this.intervalTimer) clearInterval(this.intervalTimer);

    this.intervalTimer = setInterval(() => {
      this.tick().catch((err) => {
        logger.error('[ListeningTracker] Error in tick loop:', { error: err.message });
      });
    }, this.intervalMs);

    logger.info('[ListeningTracker] Listening presence tracker started.');
  }

  /**
   * Stop periodic tracking tick loop
   */
  stop() {
    if (this.intervalTimer) {
      clearInterval(this.intervalTimer);
      this.intervalTimer = null;
    }
  }

  /**
   * Periodic tick evaluate active voice channels with bot + users
   */
  async tick() {
    if (!this.client || !this.client.lavalink) return;

    const now = Date.now();
    const players = Array.from(this.client.lavalink.players.values());

    for (const player of players) {
      const guildId = player.guildId;
      const voiceChannelId = player.voiceChannelId;
      if (!voiceChannelId) continue;

      const channel = this.client.channels.cache.get(voiceChannelId);
      if (!channel || !channel.members) continue;

      const humanMembers = Array.from(channel.members.values()).filter((m) => !m.user.bot);
      if (humanMembers.length === 0) {
        this.lastTickMap.delete(guildId);
        continue;
      }

      const lastTick = this.lastTickMap.get(guildId) || now;
      const elapsedMs = now - lastTick;
      const elapsedSeconds = Math.floor(elapsedMs / 1000);

      this.lastTickMap.set(guildId, now);

      if (elapsedSeconds <= 0) continue;

      // 1. Increment Guild Listening Time (Server gets 1x elapsed time regardless of user count)
      const guildName = channel.guild?.name || '';
      await guildRepo.incrementGuildListeningTime(guildId, elapsedSeconds, guildName);

      // Fetch Guild Settings to check for custom levelUpChannelId
      const guildSettings = await guildRepo.getGuildSettings(guildId).catch(() => null);

      // 2. Increment Each Human User's Listening Time & Award XP
      for (const member of humanMembers) {
        const userId = member.user.id;
        const res = await userRepo.addListeningTimeAndXP(userId, elapsedSeconds, guildId, guildName);

        if (res) {
          // Level Up Canvas Notification + Mention
          if (res.leveledUp) {
            try {
              // Determine target channel: Configured LevelUp Channel -> Music Text Channel (nowplaying) -> Guild System Channel
              let targetChannelId = guildSettings?.musicSettings?.levelUpChannelId || player.textChannelId;
              let targetChannel = targetChannelId ? this.client.channels.cache.get(targetChannelId) : null;

              if (!targetChannel && channel.guild) {
                targetChannel = channel.guild.systemChannel;
              }

              if (targetChannel && typeof targetChannel.send === 'function') {
                const emblemCosmetic = getCosmeticById(res.user?.equippedCosmetics?.levelEmblem);
                const emblemIcon = emblemCosmetic?.icon || '⭐';

                const buffer = await generateLevelUpCard(member.user || member, res.newLevel, emblemIcon);
                const attachment = new AttachmentBuilder(buffer, { name: `levelup-${userId}.png` });

                await targetChannel.send({
                  content: `🎉 **LEVEL UP!** <@${userId}> reached **Level ${res.newLevel}**!`,
                  files: [attachment],
                });
                logger.info(`[ListeningTracker] Level-Up Canvas notification sent for user ${userId} (Level ${res.newLevel}) in guild ${guildId}`);
              }
            } catch (notifyErr) {
              logger.error(`[ListeningTracker] Failed to send Level-Up notification for ${userId}:`, { error: notifyErr.message });
            }
          }

          // Record daily listening streak
          await ListeningStreak.recordActivity(userId).catch(() => {});

          // Check & evaluate achievements
          const userDoc = res.user;
          const stats = {
            totalTracksPlayed: userDoc?.statistics?.songsPlayed || 0,
            totalListeningTimeSeconds: userDoc?.statistics?.timeListenedSeconds || 0,
          };
          await AchievementEngine.evaluateAchievements(userId, stats, {}).catch(() => {});
        }
      }
    }
  }
}

const listeningTrackerInstance = new ListeningTracker();
module.exports = listeningTrackerInstance;
