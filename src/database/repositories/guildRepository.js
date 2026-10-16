const Guild = require('../models/Guild');
const logger = require('../../logger/logger');

// L1 Memory Cache with TTL (5 minutes)
const cache = new Map();
const CACHE_TTL_MS = 5 * 60 * 1000;

const getFromCache = (guildId) => {
  const cached = cache.get(guildId);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.data;
  }
  cache.delete(guildId);
  return null;
};

const setCache = (guildId, data) => {
  if (cache.size > 2000) {
    const firstKey = cache.keys().next().value;
    cache.delete(firstKey);
  }
  cache.set(guildId, { data, timestamp: Date.now() });
};

const invalidateCache = (guildId) => {
  cache.delete(guildId);
};

const getGuildSettings = async (guildId) => {
  const cached = getFromCache(guildId);
  if (cached) return cached;

  try {
    let guild = await Guild.findOne({ guildId }).lean();
    if (!guild) {
      guild = await Guild.create({ guildId });
      guild = guild.toObject();
    }
    setCache(guildId, guild);
    return guild;
  } catch (error) {
    logger.error(`[GuildRepo] Error getting guild settings for ${guildId}:`, { error: error.message });
    return { guildId, prefix: '*', musicSettings: { defaultVolume: 100, maxQueueSize: 500, autoplay: false } };
  }
};

const updateGuildSettings = async (guildId, updateData) => {
  try {
    const updated = await Guild.findOneAndUpdate(
      { guildId },
      { $set: updateData },
      { new: true, upsert: true }
    ).lean();
    invalidateCache(guildId);
    return updated;
  } catch (error) {
    logger.error(`[GuildRepo] Error updating guild settings for ${guildId}:`, { error: error.message });
    throw error;
  }
};

const incrementGuildListeningTime = async (guildId, addedSeconds, guildName = '') => {
  if (!addedSeconds || addedSeconds <= 0) return;
  try {
    const update = {
      $inc: {
        totalListeningSeconds: addedSeconds,
        'statistics.totalListeningSeconds': addedSeconds,
      },
    };
    if (guildName) {
      update.$set = { guildName };
    }
    await Guild.updateOne({ guildId }, update, { upsert: true });
    invalidateCache(guildId);
  } catch (error) {
    logger.error(`[GuildRepo] Error incrementing listening time for guild ${guildId}:`, { error: error.message });
  }
};

const getGlobalTopServers = async (limit = 10, client = null) => {
  try {
    const guildMap = new Map();

    // 1. Fetch from Guild collection (only those with listening time recorded)
    const guildDocs = await Guild.find({
      guildId: { $exists: true, $ne: null, $ne: 'null', $ne: 'undefined' },
      $or: [
        { totalListeningSeconds: { $gt: 0 } },
        { 'statistics.totalListeningSeconds': { $gt: 0 } }
      ]
    }).lean();

    for (const g of guildDocs) {
      if (!g.guildId) continue;
      const strId = String(g.guildId).trim();
      if (!strId || strId === 'null' || strId === 'undefined') continue;
      const secs = Math.max(g.totalListeningSeconds || 0, g.statistics?.totalListeningSeconds || 0);
      if (secs <= 0) continue;
      guildMap.set(strId, {
        guildId: strId,
        guildName: g.guildName || '',
        totalListeningSeconds: secs,
        songsPlayed: g.statistics?.songsPlayed || 0,
        commandsUsed: g.statistics?.commandsUsed || 0,
      });
    }

    // 2. Aggregate per-guild listening time from User documents (guildListeningTime array)
    try {
      const User = require('../models/User');
      const userGuildAgg = await User.aggregate([
        { $unwind: '$guildListeningTime' },
        {
          $group: {
            _id: '$guildListeningTime.guildId',
            guildName: { $first: '$guildListeningTime.guildName' },
            totalSecs: { $sum: '$guildListeningTime.listeningSeconds' }
          }
        },
        { $match: { totalSecs: { $gt: 0 } } }
      ]);

      for (const item of userGuildAgg) {
        if (!item._id) continue;
        const strId = String(item._id).trim();
        if (!strId || strId === 'null' || strId === 'undefined') continue;

        const userSecs = item.totalSecs || 0;
        if (userSecs <= 0) continue;
        const existing = guildMap.get(strId);

        if (existing) {
          existing.totalListeningSeconds = Math.max(existing.totalListeningSeconds, userSecs);
          if (!existing.guildName && item.guildName) existing.guildName = item.guildName;
        } else {
          guildMap.set(strId, {
            guildId: strId,
            guildName: item.guildName || '',
            totalListeningSeconds: userSecs,
            songsPlayed: 0,
            commandsUsed: 0,
          });
        }
      }
    } catch (aggErr) {
      logger.error('[GuildRepo] Error aggregating user guildListeningTime:', { error: aggErr.message });
    }

    // 3. Populate live client guilds cache for known active servers to get latest server names
    if (client?.guilds?.cache) {
      for (const [guildId, guild] of client.guilds.cache) {
        const existing = guildMap.get(guildId);
        if (existing) {
          if (!existing.guildName && guild.name) {
            existing.guildName = guild.name;
          }
        }
      }
    }

    // 4. Sort descending by totalListeningSeconds and strictly return only active servers (> 0s)
    const activeServers = Array.from(guildMap.values())
      .filter((g) => (g.totalListeningSeconds || 0) > 0)
      .sort((a, b) => b.totalListeningSeconds - a.totalListeningSeconds);

    return activeServers.slice(0, limit);
  } catch (error) {
    logger.error('[GuildRepo] Error fetching global top servers:', { error: error.message });
    return [];
  }
};

const resetGuildStats = async (guildId) => {
  if (!guildId) throw new Error('Guild ID is required.');
  try {
    const updated = await Guild.findOneAndUpdate(
      { guildId },
      {
        $set: {
          totalListeningSeconds: 0,
          'statistics.songsPlayed': 0,
          'statistics.commandsUsed': 0,
          'statistics.totalListeningSeconds': 0,
        },
      },
      { new: true, upsert: true }
    ).lean();

    invalidateCache(guildId);

    // Also remove guild listening stats from all user documents
    const User = require('../models/User');
    await User.updateMany(
      { 'guildListeningTime.guildId': guildId },
      {
        $pull: {
          guildListeningTime: { guildId },
          topGuilds: { guildId },
        },
      }
    ).catch(() => {});

    return updated;
  } catch (error) {
    logger.error(`[GuildRepo] Error resetting stats for guild ${guildId}:`, { error: error.message });
    throw error;
  }
};

const resetGlobalGuildStats = async () => {
  try {
    const result = await Guild.updateMany(
      {},
      {
        $set: {
          totalListeningSeconds: 0,
          'statistics.songsPlayed': 0,
          'statistics.commandsUsed': 0,
          'statistics.totalListeningSeconds': 0,
        },
      }
    );

    cache.clear();

    // Clear guild listening stats from all user documents
    const User = require('../models/User');
    await User.updateMany(
      {},
      {
        $set: {
          guildListeningTime: [],
          topGuilds: [],
        },
      }
    ).catch(() => {});

    return result.modifiedCount || 0;
  } catch (error) {
    logger.error('[GuildRepo] Error resetting global guild stats:', { error: error.message });
    throw error;
  }
};

module.exports = {
  getGuildSettings,
  updateGuildSettings,
  invalidateCache,
  incrementGuildListeningTime,
  getGlobalTopServers,
  resetGuildStats,
  resetGlobalGuildStats,
};
