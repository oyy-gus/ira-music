'use strict';

const { EmbedBuilder } = require('discord.js');
const { CronJob } = require('cron');
const logger = require('../../logger/logger');
const guildRepo = require('../../database/repositories/guildRepository');
const AtlantisUser = require('../../database/models/AtlantisUser');
const HuntBotSession = require('../../database/models/HuntBotSession');
const BotBan = require('../../database/models/BotBan');
const AtlantisMember = require('../../database/models/AtlantisMember');

class AtlantisService {
  constructor() {
    this.bannedUsers = new Set();
    this.huntbotTimers = new Map();
    this.reminderCooldowns = new Map();
    this.dailyResetJob = null;
    this.weeklyResetJob = null;
    this.client = null;
  }

  /**
   * Initializes Atlantis services, preloads banned users and active huntbot sessions.
   * @param {import('discord.js').Client} client
   */
  async init(client) {
    this.client = client;

    try {
      // 1. Preload banned users
      const bans = await BotBan.find({}).lean();
      this.bannedUsers.clear();
      for (const ban of bans) {
        this.bannedUsers.add(ban.userId);
      }
      logger.info(`[AtlantisService] Loaded ${this.bannedUsers.size} bot-banned users into cache.`);

      // 2. Restore active HuntBot sessions
      await this.restoreHuntBotSessions();

      // 3. Start Daily Stats Reset CronJob (resets at 00:00 UTC)
      this.scheduleDailyReset();

      // 4. Start Automatic Weekly Stats Reset CronJob (resets every Sunday at 00:00 UTC)
      this.scheduleWeeklyReset();
    } catch (err) {
      logger.error('[AtlantisService] Error during initialization:', { error: err.message });
    }
  }

  // ─── BANNED USERS ────────────────────────────────────────────────────────
  isBotBanned(userId) {
    if (!userId) return false;
    return this.bannedUsers.has(String(userId));
  }

  async addBotBan(userId, username, reason, bannedBy) {
    const id = String(userId);
    this.bannedUsers.add(id);
    await BotBan.findOneAndUpdate(
      { userId: id },
      { userId: id, username: username || '', reason: reason || 'No reason provided', bannedBy: bannedBy || 'Admin' },
      { upsert: true, new: true }
    );
  }

  async removeBotBan(userId) {
    const id = String(userId);
    this.bannedUsers.delete(id);
    await BotBan.deleteOne({ userId: id });
  }

  async getAllBotBans() {
    return BotBan.find({}).lean();
  }

  // ─── USER & GUILD DATA HELPERS ──────────────────────────────────────────
  async getOrCreateUser(userId) {
    const id = String(userId);
    let user = await AtlantisUser.findOne({ userId: id });
    if (!user) {
      user = await AtlantisUser.create({
        userId: id,
        reminders: {
          hunt: true,
          battle: false,
          owo: false,
          praycurse: true,
          huntbot: true,
        },
        stats: {
          owoCount: 0,
          huntCount: 0,
          battleCount: 0,
          praycurseCount: 0,
          completedHuntbots: 0,
          totalHuntbotTime: 0,
          dailyOwoCount: 0,
          dailyHuntCount: 0,
          dailyBattleCount: 0,
          dailyPraycurseCount: 0,
          guilds: new Map(),
        },
      });
    }
    return user;
  }

  async incrementStats(userId, statKey, guildId = null) {
    try {
      const id = String(userId);
      const dailyKey = `stats.daily${statKey.charAt(0).toUpperCase() + statKey.slice(1)}`;
      const totalKey = `stats.${statKey}`;

      const update = {
        $inc: {
          [totalKey]: 1,
          [dailyKey]: 1,
        },
      };

      if (guildId) {
        update.$inc[`stats.guilds.${guildId}.${statKey}`] = 1;
        update.$inc[`stats.guilds.${guildId}.daily${statKey.charAt(0).toUpperCase() + statKey.slice(1)}`] = 1;
      }

      await AtlantisUser.updateOne({ userId: id }, update, { upsert: true });
    } catch (err) {
      logger.error(`[AtlantisService] Failed to increment stats for user ${userId}:`, { error: err.message });
    }
  }

  // ─── AUTO-MODERATION ENGINE ──────────────────────────────────────────────
  /**
   * Processes channel message deletion rules (delbot, deluser, owochannel, delete prefix rules).
   * @param {import('discord.js').Message} message
   * @returns {Promise<boolean>} True if message was scheduled for deletion
   */
  async handleAutoModeration(message) {
    if (!message.guild || !message.channel) return false;

    try {
      const guildSettings = await guildRepo.getGuildSettings(message.guild.id);
      const atlantis = guildSettings?.atlantisSettings;
      if (!atlantis) return false;

      const channelId = message.channel.id;
      const content = (message.content || '').trim().toLowerCase();
      let shouldDelete = false;

      // 1. Delete bot messages
      if (message.author.bot && atlantis.deleteBotMessagesChannels?.includes(channelId)) {
        shouldDelete = true;
      }

      // 2. Delete user messages
      if (!message.author.bot && atlantis.deleteUserMessagesChannels?.includes(channelId)) {
        shouldDelete = true;
      }

      // 3. OwO-only channel (allow only "owo" and "uwu")
      if (atlantis.owoChannels?.includes(channelId)) {
        const cleanMsg = content.replace(/\s+/g, '');
        if (cleanMsg !== 'owo' && cleanMsg !== 'uwu') {
          shouldDelete = true;
        }
      }

      // 4. Custom channel + prefix deletion rules
      if (atlantis.deleteRules && Array.isArray(atlantis.deleteRules)) {
        for (const rule of atlantis.deleteRules) {
          if (rule.channelId === channelId && rule.word && content.startsWith(rule.word.toLowerCase())) {
            shouldDelete = true;
            break;
          }
        }
      }

      if (shouldDelete) {
        const timer = setTimeout(() => {
          message.delete().catch(() => {});
        }, 150);
        if (timer.unref) timer.unref();
        return true;
      }
    } catch (err) {
      logger.debug(`[AtlantisService] Auto-mod error on message ${message.id}: ${err.message}`);
    }

    return false;
  }

  // ─── REMINDERS ENGINE ───────────────────────────────────────────────────
  /**
   * Checks message against active reminder patterns and user preferences.
   * @param {import('discord.js').Message} message
   */
  async processReminders(message) {
    if (!message.guild || !message.author) return;

    // Check OwO bot huntbot messages first (sent by OwO bot)
    if (message.author.bot) {
      if (message.author.id === '408785106942164992' || message.content.includes('BEEP BOOP')) {
        await this.handleHuntbotResponse(message);
      }
      return;
    }

    // Ignore bot-banned users
    if (this.isBotBanned(message.author.id)) return;

    const rawContent = (message.content || '').trim().toLowerCase();
    const compactContent = rawContent.replace(/\s+/g, '');

    // Get guild settings for custom OwO prefix (supports custom prefix, 'owo', and 'w')
    const guildSettings = await guildRepo.getGuildSettings(message.guild.id);
    const owoPrefix = (guildSettings?.atlantisSettings?.owoPrefix || 'owo').toLowerCase();
    const prefixRegexStr = `(?:${escapeRegex(owoPrefix)}|owo|w)`;

    const userDoc = await this.getOrCreateUser(message.author.id);
    const reminders = userDoc.reminders || {};

    // 1. OWO / UWU Reminder & Member Tracker (10 seconds)
    if (compactContent === 'owo' || compactContent === 'uwu' || /^(?:owo|uwu)\b/.test(rawContent)) {
      await this.incrementStats(message.author.id, 'owoCount', message.guild.id);
      await this.trackMemberOwo(message);

      if (reminders.owo) {
        this.setSimpleReminder({
          userId: message.author.id,
          type: 'owo',
          durationMs: 10000,
          channel: message.channel,
          user: message.author,
          messageText: `<@${message.author.id}>, \`owo\` cooldown has passed! (｡♥‿♥｡)`,
          autoDeleteMs: 4000,
        });
      }
    }

    // 2. HUNT Reminder & Stat (15 seconds) - Matches 'w hunt', 'w h', 'wh', 'owo hunt', 'owoh', etc.
    const huntRegex = new RegExp(`^(?:(?:${prefixRegexStr})\\s*(?:hunt|h|catch)|wh|owoh)$`, 'i');
    if (huntRegex.test(rawContent) || huntRegex.test(compactContent)) {
      await this.incrementStats(message.author.id, 'huntCount', message.guild.id);

      if (reminders.hunt) {
        this.setSimpleReminder({
          userId: message.author.id,
          type: 'hunt',
          durationMs: 15000,
          channel: message.channel,
          user: message.author,
          messageText: `<@${message.author.id}>, \`hunt\` cooldown has passed! 🏹`,
          autoDeleteMs: 5000,
        });
      }
    }

    // 3. BATTLE Reminder & Stat (15 seconds) - Matches 'w battle', 'w b', 'wb', 'owo battle', 'owob', etc.
    const battleRegex = new RegExp(`^(?:(?:${prefixRegexStr})\\s*(?:battle|b|fight)|wb|owob)$`, 'i');
    if (battleRegex.test(rawContent) || battleRegex.test(compactContent)) {
      await this.incrementStats(message.author.id, 'battleCount', message.guild.id);

      if (reminders.battle) {
        this.setSimpleReminder({
          userId: message.author.id,
          type: 'battle',
          durationMs: 15000,
          channel: message.channel,
          user: message.author,
          messageText: `<@${message.author.id}>, \`battle\` cooldown has passed! ⚔️`,
          autoDeleteMs: 5000,
        });
      }
    }

    // 4. PRAY / CURSE Reminder & Stat (5 minutes = 300,000ms) - Matches 'w pray', 'wp', 'w curse', 'wc', etc.
    const prayRegex = new RegExp(`^(?:(?:${prefixRegexStr})\\s*pray|wp|owop|owopray)\\b`, 'i');
    const curseRegex = new RegExp(`^(?:(?:${prefixRegexStr})\\s*curse|wc|owoc|owocurse)\\b`, 'i');
    const isPrayMatch = prayRegex.test(rawContent) || prayRegex.test(compactContent);
    const isCurseMatch = curseRegex.test(rawContent) || curseRegex.test(compactContent);

    if (isPrayMatch || isCurseMatch) {
      await this.incrementStats(message.author.id, 'praycurseCount', message.guild.id);

      const actionName = isPrayMatch ? 'pray' : 'curse';
      const actionEmoji = isPrayMatch ? '🙏' : '💀';

      if (reminders.praycurse) {
        this.setSimpleReminder({
          userId: message.author.id,
          type: 'praycurse',
          durationMs: 300000,
          channel: message.channel,
          user: message.author,
          messageText: `<@${message.author.id}>, \`${actionName}\` cooldown has passed! ${actionEmoji}`,
          autoDeleteMs: 10000,
        });
      }
    }

    // 5. CUSTOM TIMERS
    if (userDoc.customs && Array.isArray(userDoc.customs)) {
      for (const custom of userDoc.customs) {
        if (!custom || !custom.unlocked || !custom.triggerText || !custom.time) continue;

        let matched = false;
        const triggerText = custom.triggerText.toLowerCase();

        if (custom.trigger === 'b' && rawContent.startsWith(triggerText)) {
          matched = true;
        } else if (custom.trigger === 'a' && rawContent.includes(triggerText)) {
          matched = true;
        } else if (custom.trigger === 'e' && rawContent.endsWith(triggerText)) {
          matched = true;
        }

        if (matched) {
          const timer = setTimeout(async () => {
            try {
              const sent = await message.channel.send(`<@${message.author.id}>, your custom cooldown for \`${custom.triggerText}\` has passed! ⏱️`);
              if (sent) {
                const delTimer = setTimeout(() => sent.delete().catch(() => {}), custom.time > 30000 ? 15000 : 5000);
                if (delTimer.unref) delTimer.unref();
              }
            } catch (_) {}
          }, custom.time);
          if (timer.unref) timer.unref();
        }
      }
    }
  }

  setSimpleReminder({ userId, type, durationMs, channel, messageText, autoDeleteMs = 5000 }) {
    const key = `${userId}:${type}`;
    if (this.reminderCooldowns.has(key)) return;

    this.reminderCooldowns.set(key, true);

    const timer = setTimeout(async () => {
      this.reminderCooldowns.delete(key);
      try {
        const sent = await channel.send(messageText);
        if (sent && autoDeleteMs > 0) {
          const delTimer = setTimeout(() => sent.delete().catch(() => {}), autoDeleteMs);
          if (delTimer.unref) delTimer.unref();
        }
      } catch (err) {
        logger.debug(`[AtlantisService] Reminder delivery error for ${key}: ${err.message}`);
      }
    }, durationMs);

    if (timer.unref) timer.unref();
  }

  // ─── HUNTBOT ENGINE ──────────────────────────────────────────────────────
  /**
   * Listens to OwO bot output, extracts huntbot duration, registers reminder.
   * @param {import('discord.js').Message} message
   */
  async handleHuntbotResponse(message) {
    const content = message.content || '';
    if (!content.includes('BEEP BOOP') && !content.includes('I WILL BE BACK IN')) return;
    if (content.includes('I AM BACK WITH')) return; // Return message, not dispatch

    try {
      // Extract time string like "6H2M" or "30M"
      const timeMatch = content.match(/I WILL BE BACK IN\s+([0-9HDMS]+)/i);
      if (!timeMatch || !timeMatch[1]) return;
      const durationStr = timeMatch[1].toUpperCase();

      // Parse duration into milliseconds
      const durationMs = parseHuntbotDuration(durationStr);
      if (durationMs <= 0) return;

      // Find recipient user from message mentions or member cache
      let targetUser = message.mentions.users.first();
      if (!targetUser) {
        // Attempt username match: e.g. **User#1234**, YOU SPENT
        const nameMatch = content.match(/\*\*([^*]+)\*\*,\s*YOU SPENT/i) || content.match(/`([^`]+)`\*\*,\s*YOU SPENT/i);
        if (nameMatch && nameMatch[1] && message.guild) {
          const rawName = nameMatch[1].replace(/@/g, '').trim();
          const member = message.guild.members.cache.find(
            (m) => m.user.username.toLowerCase() === rawName.toLowerCase() || m.displayName.toLowerCase() === rawName.toLowerCase()
          );
          if (member) targetUser = member.user;
        }
      }

      if (!targetUser) return;

      // Check if user has huntbot reminder enabled
      const userDoc = await this.getOrCreateUser(targetUser.id);
      if (!userDoc.reminders?.huntbot) return;

      // Add reaction acknowledging the huntbot timer
      message.react('⏰').catch(() => {});

      const timeoutAt = Date.now() + durationMs;

      // Persist session to MongoDB
      await HuntBotSession.findOneAndUpdate(
        { userId: targetUser.id },
        {
          userId: targetUser.id,
          channelId: message.channel.id,
          guildId: message.guild?.id || null,
          timeoutAt,
          durationString: durationStr,
        },
        { upsert: true, new: true }
      );

      // Increment user's total huntbot time stat
      await AtlantisUser.updateOne(
        { userId: targetUser.id },
        { $inc: { 'stats.totalHuntbotTime': durationMs } },
        { upsert: true }
      );

      // Schedule in-memory timeout
      this.scheduleHuntBotTimer(targetUser.id, message.channel.id, durationMs, durationStr);
    } catch (err) {
      logger.error('[AtlantisService] Error processing huntbot response:', { error: err.message });
    }
  }

  scheduleHuntBotTimer(userId, channelId, remainingMs, durationStr) {
    if (this.huntbotTimers.has(userId)) {
      clearTimeout(this.huntbotTimers.get(userId));
    }

    const timer = setTimeout(async () => {
      this.huntbotTimers.delete(userId);

      try {
        // Clean up from DB
        await HuntBotSession.deleteOne({ userId });
        await AtlantisUser.updateOne(
          { userId },
          { $inc: { 'stats.completedHuntbots': 1 } },
          { upsert: true }
        );

        const notifyText = `⏰ **|** <@${userId}>, your **HuntBot** is complete! (Took \`${durationStr}\` to finish)`;

        let sentDM = false;
        if (this.client) {
          try {
            const user = await this.client.users.fetch(userId);
            if (user) {
              await user.send(notifyText);
              sentDM = true;
            }
          } catch (_) {}
        }

        if (!sentDM && this.client && channelId) {
          try {
            const channel = await this.client.channels.fetch(channelId);
            if (channel && channel.isTextBased()) {
              await channel.send(`${notifyText}\n*(Sent here because direct messages are disabled)*`);
            }
          } catch (_) {}
        }
      } catch (err) {
        logger.error(`[AtlantisService] Error delivering huntbot completion for user ${userId}:`, { error: err.message });
      }
    }, Math.max(remainingMs, 500));

    if (timer.unref) timer.unref();
    this.huntbotTimers.set(userId, timer);
  }

  async restoreHuntBotSessions() {
    try {
      const activeSessions = await HuntBotSession.find({}).lean();
      const now = Date.now();

      for (const session of activeSessions) {
        const remainingMs = session.timeoutAt - now;
        if (remainingMs <= 0) {
          this.scheduleHuntBotTimer(session.userId, session.channelId, 1000, session.durationString || 'Unknown');
        } else {
          this.scheduleHuntBotTimer(session.userId, session.channelId, remainingMs, session.durationString || 'Unknown');
        }
      }
      logger.info(`[AtlantisService] Restored ${activeSessions.length} active HuntBot sessions.`);
    } catch (err) {
      logger.error('[AtlantisService] Error restoring HuntBot sessions:', { error: err.message });
    }
  }

  // ─── DAILY STATS RESET ───────────────────────────────────────────────────
  scheduleDailyReset() {
    try {
      // Runs daily at 00:00 UTC (or equivalent 03:00 America/New_York as in Atlantis)
      this.dailyResetJob = new CronJob(
        '0 0 0 * * *',
        async () => {
          await this.performDailyStatsReset();
        },
        null,
        true,
        'UTC'
      );
      this.dailyResetJob.start();
      logger.info('[AtlantisService] Daily stats reset CronJob scheduled for 00:00 UTC.');
    } catch (err) {
      logger.error('[AtlantisService] Failed to schedule CronJob:', { error: err.message });
    }
  }

  // ─── AUTOMATIC WEEKLY STATS RESET (SUNDAY 00:00 UTC) ───────────────────
  scheduleWeeklyReset() {
    try {
      // Runs weekly at 00:00 UTC every Sunday (standard rollover)
      this.weeklyResetJob = new CronJob(
        '0 0 0 * * 0',
        async () => {
          logger.info('[AtlantisService] Automatic weekly stats reset triggered by CronJob...');
          await this.weekReset(null);
        },
        null,
        true,
        'UTC'
      );
      this.weeklyResetJob.start();
      logger.info('[AtlantisService] Automatic weekly reset CronJob scheduled for Sunday 00:00 UTC.');
    } catch (err) {
      logger.error('[AtlantisService] Failed to schedule weekly reset CronJob:', { error: err.message });
    }
  }

  async performDailyStatsReset() {
    try {
      logger.info('[AtlantisService] Starting daily stats reset...');
      // 1. Reset global daily stats for all users
      await AtlantisUser.updateMany(
        {},
        {
          $set: {
            'stats.dailyOwoCount': 0,
            'stats.dailyHuntCount': 0,
            'stats.dailyBattleCount': 0,
            'stats.dailyPraycurseCount': 0,
          },
        }
      );

      // 2. Reset per-server daily stats across all servers in stats.guilds
      const usersWithGuilds = await AtlantisUser.find({ 'stats.guilds': { $exists: true } });
      const bulkOps = [];
      for (const u of usersWithGuilds) {
        const guildsObj = u.stats?.guilds;
        if (!guildsObj) continue;
        const guildKeys = guildsObj instanceof Map ? Array.from(guildsObj.keys()) : Object.keys(guildsObj);
        if (guildKeys.length === 0) continue;

        const updateSet = {};
        for (const gId of guildKeys) {
          updateSet[`stats.guilds.${gId}.dailyOwoCount`] = 0;
          updateSet[`stats.guilds.${gId}.dailyHuntCount`] = 0;
          updateSet[`stats.guilds.${gId}.dailyBattleCount`] = 0;
          updateSet[`stats.guilds.${gId}.dailyPraycurseCount`] = 0;
        }

        bulkOps.push({
          updateOne: {
            filter: { _id: u._id },
            update: { $set: updateSet },
          },
        });
      }

      if (bulkOps.length > 0) {
        await AtlantisUser.bulkWrite(bulkOps);
      }

      logger.info('[AtlantisService] Daily stats reset complete (both global and per-guild dailies reset).');
    } catch (err) {
      logger.error('[AtlantisService] Daily stats reset error:', { error: err.message });
    }
  }

  // ─── COMMUNITY MEMBER WEBSITE TRACKING (GLOBAL MULTI-SERVER) ───────────
  async trackMemberOwo(message) {
    if (!message.guild || !message.author || message.author.bot) return;

    try {
      const member = message.member || (await message.guild.members.fetch(message.author.id).catch(() => null));
      const isStaff = member?.permissions?.has('ManageGuild') || member?.permissions?.has('Administrator') || false;
      const isBooster = !!member?.premiumSince;

      const userTag = message.author.tag || `${message.author.username}#${message.author.discriminator || '0'}`;
      const avatar = message.author.displayAvatarURL({ extension: 'png', size: 128 });
      const guildName = message.guild.name || '';

      await AtlantisMember.findOneAndUpdate(
        { guildId: message.guild.id, userId: message.author.id },
        {
          $setOnInsert: {
            guildId: message.guild.id,
            userId: message.author.id,
            joinedServer: member?.joinedAt || new Date(),
            owosArchive: [],
          },
          $inc: { owosPastWeek: 1 },
          $set: {
            guildName,
            userTag,
            avatar,
            nickname: member?.nickname || message.author.displayName || message.author.username,
            level: isStaff ? 3 : isBooster ? 2 : 1,
            premium: member?.premiumSince || null,
          },
        },
        { upsert: true, new: true }
      );
    } catch (err) {
      logger.warn(`[AtlantisService] trackMemberOwo error: ${err.message}`, {
        guildId: message.guild?.id,
        userId: message.author?.id,
        error: err.message,
      });
    }
  }

  // ─── WEBSITE & LEADERBOARD ACTIONS (GLOBAL & PER-SERVER SCOPED) ──────────
  async getMembersLeaderboard(guildId = null) {
    if (guildId && guildId !== 'all') {
      const aotw = await AtlantisMember.find({ guildId }).sort({ owosPastWeek: -1 }).limit(3).lean();
      const aotwIds = new Set(aotw.map((m) => m.userId));

      const allMatching = await AtlantisMember.find({ guildId }).sort({ owosPastWeek: -1 }).limit(100).lean();
      const members = allMatching.filter((m) => !aotwIds.has(m.userId));

      return { aotw, members, currentGuildId: guildId };
    }

    // Global view across all servers: Group by userId so each user appears once with their aggregated OwOs!
    let aggregated = [];
    if (typeof AtlantisMember.aggregate === 'function') {
      try {
        aggregated = await AtlantisMember.aggregate([
          {
            $group: {
              _id: '$userId',
              userId: { $first: '$userId' },
              userTag: { $first: '$userTag' },
              nickname: { $first: '$nickname' },
              avatar: { $first: '$avatar' },
              level: { $max: '$level' },
              premium: { $first: '$premium' },
              owosPastWeek: { $sum: '$owosPastWeek' },
              guildName: { $first: '$guildName' },
              serverCount: { $sum: 1 },
              joinedServer: { $min: '$joinedServer' },
            },
          },
          { $sort: { owosPastWeek: -1 } },
          { $limit: 100 },
        ]);
      } catch (_) {
        // Fallback if aggregate fails or in unit tests
        aggregated = await AtlantisMember.find({}).sort({ owosPastWeek: -1 }).limit(100).lean();
      }
    } else {
      aggregated = await AtlantisMember.find({}).sort({ owosPastWeek: -1 }).limit(100).lean();
    }

    const aotw = aggregated.slice(0, 3);
    const aotwIds = new Set(aotw.map((m) => m.userId));
    const members = aggregated.slice(3).filter((m) => !aotwIds.has(m.userId));

    return { aotw, members, currentGuildId: null };
  }

  async getMember(userId, guildId = null) {
    const id = String(userId);
    if (guildId && guildId !== 'all') {
      const m = await AtlantisMember.findOne({ userId: id, guildId }).lean();
      if (m) return m;
    }

    // Global lookup across all servers
    const allRecords = await AtlantisMember.find({ userId: id }).lean();
    if (!allRecords || allRecords.length === 0) {
      return null;
    }

    const primary = allRecords.reduce((max, r) => ((r.owosPastWeek || 0) > (max.owosPastWeek || 0) ? r : max), allRecords[0]);
    const totalOwosPastWeek = allRecords.reduce((sum, r) => sum + (r.owosPastWeek || 0), 0);
    const maxLevel = allRecords.reduce((max, r) => Math.max(max, r.level || 1), 1);

    const mergedArchives = [];
    for (const r of allRecords) {
      if (Array.isArray(r.owosArchive)) {
        mergedArchives.push(...r.owosArchive);
      }
    }

    return {
      ...primary,
      level: maxLevel,
      owosPastWeek: totalOwosPastWeek,
      owosArchive: mergedArchives.sort((a, b) => Number(b.time || 0) - Number(a.time || 0)),
      serverCount: allRecords.length,
      isGlobalView: !guildId || guildId === 'all',
    };
  }

  async weekReset(guildId = null) {
    const now = new Date();
    const endDay = new Date(now);
    if (now.getDay() === 0) {
      endDay.setDate(now.getDate() - 1);
    } else {
      endDay.setDate(now.getDate() - now.getDay() + 6);
    }
    const startDay = new Date(endDay);
    startDay.setDate(endDay.getDate() - 6);
    const weekOf = `${startDay.getMonth() + 1}/${startDay.getDate()} - ${endDay.getMonth() + 1}/${endDay.getDate()}`;

    const filter = guildId && guildId !== 'all' ? { guildId } : {};
    const members = await AtlantisMember.find(filter);

    const archiveTime = String(Date.now());
    const bulkOps = members.map((member) => {
      const pastCount = member.owosPastWeek || 0;
      return {
        updateOne: {
          filter: { _id: member._id },
          update: {
            $set: { owosPastWeek: 0 },
            $push: {
              owosArchive: {
                weekOf,
                amountOfOwos: pastCount,
                hitreq: pastCount >= 50 ? '✔️' : '❌',
                time: archiveTime,
              },
            },
          },
        },
      };
    });

    if (bulkOps.length > 0) {
      if (typeof AtlantisMember.bulkWrite === 'function') {
        await AtlantisMember.bulkWrite(bulkOps);
      } else {
        for (const op of bulkOps) {
          await AtlantisMember.updateOne(op.updateOne.filter, op.updateOne.update);
        }
      }
    }

    logger.info(`[AtlantisService] Performed weekly reset for ${members.length} members (Guild: ${guildId || 'Global'}). Week: ${weekOf}`);
    return { status: 'OK', weekOf, memberCount: members.length, guildId };
  }

  async excuseMemberWeek(userId, time, guildId = null) {
    const filter = { userId: String(userId) };
    if (guildId && guildId !== 'all') filter.guildId = guildId;
    const member = await AtlantisMember.findOne(filter);
    if (!member) throw new Error('Member not found');

    const updatedArchives = (member.owosArchive || []).map((item) => {
      if (item.time === String(time)) {
        return { ...item, hitreq: '⚠️' };
      }
      return item;
    });

    await AtlantisMember.updateOne({ _id: member._id }, { $set: { owosArchive: updatedArchives } });
    return { status: 'OK' };
  }

  async deleteMember(userId, guildId = null) {
    const filter = { userId: String(userId) };
    if (guildId && guildId !== 'all') filter.guildId = guildId;
    return AtlantisMember.deleteOne(filter);
  }
}

// ─── HELPER FUNCTIONS ─────────────────────────────────────────────────────
function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function parseHuntbotDuration(durationStr) {
  let ms = 0;
  const matches = durationStr.match(/(\d+)([HMSD])/g);
  if (!matches) return 0;

  for (const part of matches) {
    const unit = part.slice(-1);
    const val = parseInt(part.slice(0, -1), 10);
    if (isNaN(val)) continue;

    if (unit === 'S') ms += val * 1000;
    else if (unit === 'M') ms += val * 60000;
    else if (unit === 'H') ms += val * 3600000;
    else if (unit === 'D') ms += val * 86400000;
  }

  return ms;
}

const atlantisService = new AtlantisService();
module.exports = atlantisService;
