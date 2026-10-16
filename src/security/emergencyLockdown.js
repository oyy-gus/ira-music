/**
 * Emergency Lockdown System (Global, Per-Guild, Per-Module)
 */

class EmergencyLockdown {
  constructor() {
    this.globalLockdown = false;
    this.globalReason = '';
    // Map<guildId, { reason: string, lockedModules: Set<string> }>
    this.guildLockdowns = new Map();
    // Whitelisted diagnostic / status commands that always bypass lockdown
    this.whitelistedCommands = new Set(['ping', 'stats', 'nodes', 'help', 'status']);
  }

  /**
   * Set global system lockdown
   * @param {boolean} enabled
   * @param {string} reason
   */
  setGlobalLockdown(enabled = true, reason = 'Emergency System Lockdown') {
    this.globalLockdown = enabled;
    this.globalReason = reason;
  }

  /**
   * Set guild-specific lockdown
   * @param {string} guildId
   * @param {boolean} enabled
   * @param {string} reason
   * @param {string[]} [modules]
   */
  setGuildLockdown(guildId, enabled = true, reason = 'Guild Lockdown Mode', modules = ['music', 'playlist']) {
    if (enabled) {
      this.guildLockdowns.set(guildId, {
        reason,
        lockedModules: new Set(modules),
      });
    } else {
      this.guildLockdowns.delete(guildId);
    }
  }

  /**
   * Check if a command execution is blocked by lockdown
   * @param {string} commandName
   * @param {string} guildId
   * @param {string} category
   * @returns {{ locked: boolean, reason?: string }}
   */
  isLocked(commandName, guildId, category = 'music') {
    const cmd = commandName?.toLowerCase();

    // Whitelisted diagnostics always pass
    if (this.whitelistedCommands.has(cmd)) {
      return { locked: false };
    }

    if (this.globalLockdown) {
      return { locked: true, reason: this.globalReason || 'System is currently under maintenance lockdown.' };
    }

    const guildLock = this.guildLockdowns.get(guildId);
    if (guildLock && (guildLock.lockedModules.has('*') || guildLock.lockedModules.has(category))) {
      return { locked: true, reason: guildLock.reason || 'Music commands are temporarily restricted in this server.' };
    }

    return { locked: false };
  }
}

module.exports = new EmergencyLockdown();
