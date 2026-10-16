const permissionCache = require('./permissionCache');
const guildRepo = require('../database/repositories/guildRepository');
const logger = require('../logger/logger');

// Standard bot permission nodes
const PermissionNodes = {
  MUSIC_PLAY: 'music.play',
  MUSIC_SKIP: 'music.skip',
  MUSIC_STOP: 'music.stop',
  MUSIC_PAUSE: 'music.pause',
  MUSIC_RESUME: 'music.resume',
  MUSIC_QUEUE: 'music.queue',
  MUSIC_SEEK: 'music.seek',
  MUSIC_VOLUME: 'music.volume',
  MUSIC_FILTER: 'music.filter',
  MUSIC_ADMIN: 'music.admin',
  PLAYLIST_CREATE: 'playlist.create',
  PLAYLIST_DELETE: 'playlist.delete',
  PLAYLIST_EDIT: 'playlist.edit',
  ANALYTICS_VIEW: 'analytics.view',
  SYSTEM_ADMIN: 'system.admin',
};

class PermissionEngine {
  /**
   * Map command name to primary permission node
   * @param {string} commandName
   * @returns {string}
   */
  static getCommandNode(commandName) {
    const cmd = commandName.toLowerCase();
    const map = {
      play: PermissionNodes.MUSIC_PLAY,
      skip: PermissionNodes.MUSIC_SKIP,
      stop: PermissionNodes.MUSIC_STOP,
      pause: PermissionNodes.MUSIC_PAUSE,
      resume: PermissionNodes.MUSIC_RESUME,
      queue: PermissionNodes.MUSIC_QUEUE,
      volume: PermissionNodes.MUSIC_VOLUME,
      filter: PermissionNodes.MUSIC_FILTER,
      seek: PermissionNodes.MUSIC_SEEK,
      playlist: PermissionNodes.PLAYLIST_CREATE,
      stats: PermissionNodes.ANALYTICS_VIEW,
      nodes: PermissionNodes.SYSTEM_ADMIN,
    };
    return map[cmd] || `command.${cmd}`;
  }

  /**
   * Resolve permission for user in a guild context
   * Resolution Hierarchy:
   * 1. System Owner Override
   * 2. Guild Owner Override
   * 3. Explicit User Deny / Allow
   * 4. Role Permissions (with explicit deny preference)
   * 5. Guild-wide Permissions
   * 6. Default command permissions
   *
   * @param {Object} options
   * @param {string} options.guildId
   * @param {Object} options.member - GuildMember discord.js object
   * @param {string} options.commandName
   * @param {string} [options.permissionNode]
   * @returns {Promise<{ allowed: boolean, reason?: string, node: string }>}
   */
  static async evaluatePermission({ guildId, member, commandName, permissionNode }) {
    const node = permissionNode || this.getCommandNode(commandName);
    const userId = member.id;

    // 1. Check Permission Cache
    const cachedResult = permissionCache.get(guildId, userId, node);
    if (cachedResult !== null) {
      return { allowed: cachedResult, node, cached: true };
    }

    // 2. Guild Owner or Administrator permission bypass
    if (member.guild?.ownerId === userId || member.permissions?.has('Administrator')) {
      return { allowed: true, node, reason: 'ADMIN_BYPASS' };
    }

    // 3. Fetch custom guild settings
    let guildSettings = null;
    try {
      guildSettings = await guildRepo.getGuildSettings(guildId);
    } catch (err) {
      logger.warn(`[PermissionEngine] Failed to load guild permissions for ${guildId}: ${err.message}`);
    }

    const customPerms = guildSettings?.permissions || { userDenies: [], roleDenies: [], roleAllows: [] };

    // Explicit User Deny Check
    if (customPerms.userDenies?.includes(userId)) {
      permissionCache.set(guildId, userId, new Set(), new Set([node, '*']));
      return { allowed: false, node, reason: 'EXPLICIT_USER_DENY' };
    }

    // Role-level resolution
    const memberRoleIds = Array.from(member.roles?.cache?.keys() || []);

    // Explicit Role Deny
    const hasRoleDeny = customPerms.roleDenies?.some((rId) => memberRoleIds.includes(rId));
    if (hasRoleDeny) {
      permissionCache.set(guildId, userId, new Set(), new Set([node]));
      return { allowed: false, node, reason: 'EXPLICIT_ROLE_DENY' };
    }

    // Explicit Role Allow (Admin override)
    if (node === PermissionNodes.SYSTEM_ADMIN || node === PermissionNodes.MUSIC_ADMIN) {
      const hasDjRole = guildSettings?.djRoleId && memberRoleIds.includes(guildSettings.djRoleId);
      if (hasDjRole) {
        return { allowed: true, node, reason: 'DJ_ROLE_ALLOW' };
      }
      return { allowed: false, node, reason: 'REQUIRES_ADMIN_OR_DJ' };
    }

    // Default Allow for standard music/utility commands
    permissionCache.set(guildId, userId, new Set([node]), new Set());
    return { allowed: true, node, reason: 'DEFAULT_ALLOW' };
  }

  /**
   * Invalidate cache on role/guild changes
   */
  static invalidate(guildId, userId = null) {
    if (userId) {
      permissionCache.invalidateUser(guildId, userId);
    } else {
      permissionCache.invalidateGuild(guildId);
    }
  }
}

module.exports = {
  PermissionEngine,
  PermissionNodes,
};
