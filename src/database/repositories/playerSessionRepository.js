const PlayerSession = require('../models/PlayerSession');
const logger = require('../../logger/logger');

/**
 * Upsert or save player session snapshot to MongoDB
 */
const saveSession = async (sessionData) => {
  if (!sessionData || !sessionData.guildId) return null;
  try {
    const filter = { guildId: sessionData.guildId };
    const update = {
      ...sessionData,
      lastHeartbeat: new Date(),
      updatedAt: new Date(),
    };
    const options = { upsert: true, new: true, setDefaultsOnInsert: true };
    return await PlayerSession.findOneAndUpdate(filter, update, options);
  } catch (error) {
    logger.error(`[PlayerSessionRepo] Failed to save session for guild ${sessionData.guildId}:`, {
      error: error.message,
    });
    return null;
  }
};

/**
 * Get active player session by guildId
 */
const getSession = async (guildId) => {
  if (!guildId) return null;
  try {
    return await PlayerSession.findOne({ guildId }).lean();
  } catch (error) {
    logger.error(`[PlayerSessionRepo] Failed to fetch session for guild ${guildId}:`, {
      error: error.message,
    });
    return null;
  }
};

/**
 * Fetch all sessions eligible for restart / failover recovery
 */
const getAllActiveSessions = async () => {
  try {
    const activeStatuses = ['NORMAL', 'PLAYING', 'PAUSED', 'MIGRATING', 'RECOVERING', 'SAVED_FOR_RESTART'];
    // Filter sessions updated/heartbeated within the last 24 hours to prevent extreme stale recoveries
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
    return await PlayerSession.find({
      $or: [
        { status: { $in: activeStatuses } },
        { autoplay: true },
        { status: 'IDLE', voiceChannelId: { $ne: null } },
      ],
      lastHeartbeat: { $gte: cutoff },
    }).lean();
  } catch (error) {
    logger.error('[PlayerSessionRepo] Failed to fetch all active sessions:', { error: error.message });
    return [];
  }
};

/**
 * Delete a session once player is legitimately destroyed/idle
 */
const deleteSession = async (guildId) => {
  if (!guildId) return;
  try {
    await PlayerSession.deleteOne({ guildId });
  } catch (error) {
    logger.error(`[PlayerSessionRepo] Failed to delete session for guild ${guildId}:`, {
      error: error.message,
    });
  }
};

/**
 * Update position and heartbeat
 */
const updateSessionPosition = async (guildId, position) => {
  if (!guildId) return;
  try {
    await PlayerSession.updateOne(
      { guildId },
      {
        $set: {
          position,
          positionUpdatedAt: new Date(),
          lastHeartbeat: new Date(),
        },
      }
    );
  } catch (error) {
    logger.warn(`[PlayerSessionRepo] Failed to update position for guild ${guildId}:`, {
      error: error.message,
    });
  }
};

/**
 * Update session status
 */
const updateSessionStatus = async (guildId, status, lastError = null) => {
  if (!guildId) return;
  try {
    const update = { status, lastHeartbeat: new Date() };
    if (lastError !== null) update.lastError = lastError;
    await PlayerSession.updateOne({ guildId }, { $set: update });
  } catch (error) {
    logger.error(`[PlayerSessionRepo] Failed to update status for guild ${guildId}:`, {
      error: error.message,
    });
  }
};

/**
 * Cleanup stale sessions older than maxAgeMs (default 24h)
 */
const cleanupStaleSessions = async (maxAgeMs = 24 * 60 * 60 * 1000) => {
  try {
    const threshold = new Date(Date.now() - maxAgeMs);
    const result = await PlayerSession.deleteMany({
      lastHeartbeat: { $lt: threshold },
    });
    if (result.deletedCount > 0) {
      logger.info(`[PlayerSessionRepo] Cleaned up ${result.deletedCount} stale player sessions.`);
    }
    return result.deletedCount;
  } catch (error) {
    logger.error('[PlayerSessionRepo] Error during stale sessions cleanup:', { error: error.message });
    return 0;
  }
};

module.exports = {
  saveSession,
  getSession,
  getAllActiveSessions,
  deleteSession,
  updateSessionPosition,
  updateSessionStatus,
  cleanupStaleSessions,
};
