/**
 * TwentyFourSevenGuard
 *
 * A dedicated, self-healing guard for 24/7 voice persistence.
 * Provides:
 *   - Retry loop with exponential back-off (up to 5 attempts per disconnect event)
 *   - Lavalink-node readiness check before creating a player
 *   - Deduplication so multiple concurrent reconnect attempts cannot race each other
 *   - Heartbeat polling that runs every 30 s to catch silent failures (bot removed
 *     from VC without a voiceStateUpdate being fired, or node crash/restart)
 *   - Automatic 24/7 flag re-hydration on recovered players so queueEnd/nodeManager
 *     logic stays aware
 */

const logger = require('../../logger/logger');
const guildRepo = require('../../database/repositories/guildRepository');
const { ensureStageSpeaker } = require('../../utils/stageUtils');

// ── Internal state ────────────────────────────────────────────────────────────

/** Active back-off timers keyed by guildId */
const _activeTimers = new Map();

/** Number of pending retry attempts keyed by guildId */
const _retryCounters = new Map();

/** Heartbeat interval reference */
let _heartbeatInterval = null;

// ── Constants ─────────────────────────────────────────────────────────────────

const MAX_RETRIES = 5;
/** Back-off delays in milliseconds (attempt 1 → attempt 5) */
const BACKOFF_DELAYS = [2500, 5000, 10000, 20000, 30000];
const HEARTBEAT_INTERVAL_MS = 30_000;

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Returns true if at least one Lavalink node is connected and usable.
 * @param {Object} client
 */
function _hasHealthyNode(client) {
  if (!client?.lavalink?.nodeManager?.nodes) return false;
  for (const [, node] of client.lavalink.nodeManager.nodes) {
    if (node.connected) return true;
  }
  return false;
}

/**
 * Re-hydrate the 24/7 flag on a player that may have been recreated without it.
 * @param {Object} player
 */
function rehydrate247Flag(player) {
  if (!player) return;
  if (typeof player.set === 'function') {
    player.set('twentyFourSeven', true);
  }
  player.twentyFourSeven = true;
}

/**
 * Check whether 247 is enabled for the given guild, consulting both the in-memory
 * player state and the database so we always have the canonical answer.
 * @param {Object} client
 * @param {string} guildId
 * @returns {Promise<{ is247: boolean, vcId: string|null, tcId: string|null }>}
 */
async function check247State(client, guildId) {
  const player = client.lavalink?.players.get(guildId);
  const playerFlag = Boolean(
    player?.get?.('twentyFourSeven') || player?.twentyFourSeven,
  );

  const guildSettings = await guildRepo.getGuildSettings(guildId).catch(() => null);
  const dbFlag = Boolean(guildSettings?.musicSettings?.twentyFourSeven);

  const is247 = playerFlag || dbFlag;
  const vcId = (
    guildSettings?.musicSettings?.twentyFourSevenVC ||
    player?.voiceChannelId ||
    null
  );
  const tcId = (
    guildSettings?.musicSettings?.twentyFourSevenTC ||
    player?.textChannelId ||
    null
  );

  return { is247, vcId, tcId, guildSettings };
}

// ── Core reconnect logic ──────────────────────────────────────────────────────

/**
 * Attempt a single reconnect for a guild.
 * Returns true if connection was successfully established, false otherwise.
 * @param {Object} client
 * @param {string} guildId
 * @param {string} targetVcId
 * @param {string|null} targetTcId
 * @param {Object|null} guildSettings  - pre-fetched settings (optional)
 * @returns {Promise<boolean>}
 */
async function _attemptReconnect(client, guildId, targetVcId, targetTcId, guildSettings) {
  if (!_hasHealthyNode(client)) {
    logger.warn(`[247Guard] No healthy Lavalink node available for guild ${guildId}. Will retry.`);
    return false;
  }

  const guild = client.guilds.cache.get(guildId) ||
    await client.guilds.fetch(guildId).catch(() => null);
  if (!guild) {
    logger.warn(`[247Guard] Guild ${guildId} not found. Aborting reconnect.`);
    return false;
  }

  // Confirm voice channel still exists
  const voiceChannel = guild.channels.cache.get(targetVcId) ||
    await guild.channels.fetch(targetVcId).catch(() => null);
  if (!voiceChannel) {
    logger.warn(`[247Guard] VC ${targetVcId} not found in guild ${guildId}. Aborting.`);
    return false;
  }

  // If bot is already in the correct VC, nothing to do
  const botMember = guild.members.me;
  if (botMember?.voice?.channelId === targetVcId) {
    logger.info(`[247Guard] Bot already in VC ${targetVcId} for guild ${guildId}.`);
    return true;
  }

  try {
    let player = client.lavalink.players.get(guildId);

    if (!player) {
      player = client.lavalink.createPlayer({
        guildId,
        voiceChannelId: targetVcId,
        textChannelId: targetTcId || undefined,
        selfDeaf: true,
        selfMute: false,
        volume: guildSettings?.musicSettings?.defaultVolume || 100,
      });
    } else {
      // Update VC on existing player object
      player.voiceChannelId = targetVcId;
      if (typeof player.set === 'function') {
        player.set('voiceChannelId', targetVcId);
      }
    }

    // Ensure 247 flag is live on the player
    rehydrate247Flag(player);

    if (!player.connected) {
      await player.connect();
    }

    // Ensure bot gets Speaker role on Stage channels
    await ensureStageSpeaker(guild, targetVcId).catch(() => {});

    logger.info(`[247Guard] ✅ Successfully reconnected to VC ${targetVcId} in guild ${guild.name}`);
    return true;
  } catch (err) {
    logger.error(`[247Guard] ❌ Reconnect attempt failed for guild ${guildId}:`, {
      error: err.message,
    });
    return false;
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Schedule a reconnect cycle with exponential back-off.
 * If a reconnect is already queued for this guild it is a no-op (deduplication).
 *
 * @param {Object} client
 * @param {string} guildId
 * @param {string} targetVcId  - voice channel to reconnect to
 * @param {string|null} targetTcId - text channel (for player creation)
 * @param {Object|null} guildSettings
 */
function scheduleReconnect(client, guildId, targetVcId, targetTcId = null, guildSettings = null) {
  if (_activeTimers.has(guildId)) {
    // Already queued – don't stack timers
    return;
  }

  const attempt = (_retryCounters.get(guildId) || 0);
  if (attempt >= MAX_RETRIES) {
    logger.warn(`[247Guard] Max reconnect retries (${MAX_RETRIES}) reached for guild ${guildId}. Giving up.`);
    _retryCounters.delete(guildId);
    return;
  }

  const delay = BACKOFF_DELAYS[attempt] ?? BACKOFF_DELAYS[BACKOFF_DELAYS.length - 1];
  logger.info(`[247Guard] Scheduling reconnect attempt ${attempt + 1}/${MAX_RETRIES} for guild ${guildId} in ${delay}ms`);

  const timer = setTimeout(async () => {
    _activeTimers.delete(guildId);

    // Re-verify 247 is still desired (user may have disabled it)
    const { is247, vcId, tcId, guildSettings: freshSettings } = await check247State(client, guildId).catch(() => ({ is247: false }));
    const finalVcId = targetVcId || vcId;

    if (!is247 || !finalVcId) {
      logger.info(`[247Guard] 24/7 no longer active for guild ${guildId}. Cancelling reconnect.`);
      _retryCounters.delete(guildId);
      return;
    }

    const success = await _attemptReconnect(client, guildId, finalVcId, tcId || targetTcId, freshSettings || guildSettings);

    if (success) {
      _retryCounters.delete(guildId);
    } else {
      _retryCounters.set(guildId, attempt + 1);
      // Re-schedule next back-off attempt
      scheduleReconnect(client, guildId, finalVcId, tcId || targetTcId, freshSettings || guildSettings);
    }
  }, delay);

  _activeTimers.set(guildId, timer);
  _retryCounters.set(guildId, attempt);
}

/**
 * Cancel any pending reconnect cycle for a guild (e.g. when 247 is disabled).
 * @param {string} guildId
 */
function cancelReconnect(guildId) {
  if (_activeTimers.has(guildId)) {
    clearTimeout(_activeTimers.get(guildId));
    _activeTimers.delete(guildId);
  }
  _retryCounters.delete(guildId);
}

/**
 * Start the heartbeat that periodically checks all guilds with 247 enabled
 * and re-connects if the bot has silently left the voice channel.
 * @param {Object} client
 */
function startHeartbeat(client) {
  if (_heartbeatInterval) return; // Already running

  logger.info('[247Guard] Starting 24/7 heartbeat (every 30s)');

  _heartbeatInterval = setInterval(async () => {
    if (!client?.lavalink || !_hasHealthyNode(client)) return;

    let guildsChecked = 0;
    let guildsReconnected = 0;

    for (const [, guild] of client.guilds.cache) {
      try {
        const guildSettings = await guildRepo.getGuildSettings(guild.id).catch(() => null);
        if (!guildSettings?.musicSettings?.twentyFourSeven) continue;

        guildsChecked++;
        const targetVcId = guildSettings.musicSettings.twentyFourSevenVC;
        const targetTcId = guildSettings.musicSettings.twentyFourSevenTC;
        if (!targetVcId) continue;

        const botMember = guild.members.me;
        const isInVC = botMember?.voice?.channelId === targetVcId;
        const player = client.lavalink.players.get(guild.id);

        // Re-hydrate 24/7 flag on player if needed (survives node restarts)
        if (player && !player.get?.('twentyFourSeven') && !player.twentyFourSeven) {
          rehydrate247Flag(player);
        }

        if (!isInVC && !_activeTimers.has(guild.id)) {
          logger.warn(`[247Guard] Heartbeat detected bot not in VC ${targetVcId} for guild ${guild.name}. Triggering reconnect.`);
          _retryCounters.delete(guild.id); // Reset so it gets a fresh retry budget
          scheduleReconnect(client, guild.id, targetVcId, targetTcId, guildSettings);
          guildsReconnected++;
        }
      } catch (_) {
        // Per-guild errors must not crash the heartbeat
      }
    }

    if (guildsChecked > 0) {
      logger.debug(`[247Guard] Heartbeat: checked ${guildsChecked} 24/7 guilds, triggered ${guildsReconnected} reconnect(s).`);
    }
  }, HEARTBEAT_INTERVAL_MS);
}

/**
 * Stop the heartbeat (e.g. on graceful shutdown).
 */
function stopHeartbeat() {
  if (_heartbeatInterval) {
    clearInterval(_heartbeatInterval);
    _heartbeatInterval = null;
  }
}

module.exports = {
  scheduleReconnect,
  cancelReconnect,
  rehydrate247Flag,
  check247State,
  startHeartbeat,
  stopHeartbeat,
};
