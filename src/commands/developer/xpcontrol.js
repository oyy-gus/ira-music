'use strict';

const { EmbedBuilder, escapeMarkdown } = require('discord.js');
const userRepo = require('../../database/repositories/userRepository');
const guildRepo = require('../../database/repositories/guildRepository');
const { getEmoji } = require('../../config/emojis');
const config = require('../../config');
const { sendAutoDelete } = require('../../utils/channelUtils');

// ── Markdown helpers ─────────────────────────────────────────────────────────
// Teks dari user/error tidak boleh merusak penandaan (**bold**, `code`, dll).
const md = (s, max = 100) => escapeMarkdown(String(s ?? '')).slice(0, max);
// Untuk isi di dalam `inline code`: backtick diganti supaya tanda tidak putus.
const code = (s, max = 100) => '`' + String(s ?? '').replace(/`/g, "'").slice(0, max) + '`';
const errText = (err) => md(err?.message || err, 500);

const embed = (title, description, color) => {
  const e = new EmbedBuilder().setTitle(title).setColor(color);
  if (description) e.setDescription(description);
  return e;
};

const GREEN = 0x57F287;
const RED = 0xED4245;
const BLUE = 0x5865F2;
const ORANGE = 0xE67E22;

module.exports = {
  name: 'xpcontrol',
  description: 'Developer Admin Control: Manage XP, reset user stats, or reset server stats (per user, global user, per guild, global guild)',
  aliases: [
    'managexp', 'xpmanage', 'setxp', 'adminxp', 'devxp', 'xpdev', 'xpadmin',
    'addxp', 'removexp', 'reducexp',
    'resetuser', 'resetuserxp', 'resetxp',
    'resetglobaluser', 'resetuserglobal', 'resetallusers', 'resetuserall',
    'resetguild', 'resetserver', 'resetguildxp',
    'resetglobalguild', 'resetguildglobal', 'resetallguilds', 'resetguildall',
  ],
  category: 'developer',
  ownerOnly: true,
  cooldown: 0,
  async execute({ message, args, prefix, client }) {
    const p = prefix || '*';
    const gEmoji = (key, fallback = '') => {
      const e = getEmoji(key, fallback, client);
      return e ? `${e} ` : '';
    };
    const reply = (e) => message.reply({ embeds: [e] });
    const replyTemp = (e, ms = 6000) => sendAutoDelete(message.reply({ embeds: [e] }), ms);

    // Strict Developer / Owner Check
    const ownerId = config?.discord?.ownerId;
    if (ownerId && message.author.id !== ownerId) {
      return replyTemp(
        embed(
          `${gEmoji('error', '❌')}Developer Access Only`,
          `${gEmoji('lock', '🔒')}**This command is strictly restricted to the bot Developer.**`,
          RED,
        ),
        8000,
      );
    }

    const rawCmd = message.content?.split(/\s+/)?.[0]?.toLowerCase() || '';
    const arg0 = (args[0] || '').toLowerCase();
    const arg1 = (args[1] || '').toLowerCase();
    const arg2 = (args[2] || '').toLowerCase();

    let action = '';
    let targetArgStartIndex = 1;

    // ── ALIAS & SUBCOMMAND ROUTING ───────────────────────────────────────────
    if (rawCmd.includes('addxp')) {
      action = 'add';
      targetArgStartIndex = 0;
    } else if (rawCmd.includes('removexp') || rawCmd.includes('reducexp')) {
      action = 'remove';
      targetArgStartIndex = 0;
    } else if (['resetglobaluser', 'resetuserglobal', 'resetallusers', 'resetuserall'].some((a) => rawCmd.includes(a))) {
      action = 'reset_user_global';
    } else if (['resetglobalguild', 'resetguildglobal', 'resetallguilds', 'resetguildall'].some((a) => rawCmd.includes(a))) {
      action = 'reset_guild_global';
    } else if (rawCmd.includes('resetguild') || rawCmd.includes('resetserver')) {
      action = 'reset_guild';
      targetArgStartIndex = 0;
    } else if (rawCmd.includes('resetuser') || rawCmd.includes('resetxp')) {
      action = 'reset_user';
      targetArgStartIndex = 0;
    } else if (arg0 === 'add') {
      action = 'add';
    } else if (arg0 === 'remove' || arg0 === 'reduce') {
      action = 'remove';
    } else if (arg0 === 'reset') {
      if ((arg1 === 'user' && (arg2 === 'global' || arg2 === 'all')) || (arg1 === 'global' && arg2 === 'user')) {
        action = 'reset_user_global';
      } else if ((arg1 === 'guild' && (arg2 === 'global' || arg2 === 'all')) || (arg1 === 'global' && (arg2 === 'guild' || arg2 === 'server'))) {
        action = 'reset_guild_global';
      } else if (arg1 === 'user') {
        action = 'reset_user';
        targetArgStartIndex = 2;
      } else if (arg1 === 'guild' || arg1 === 'server') {
        action = 'reset_guild';
        targetArgStartIndex = 2;
      } else if (arg1 === 'global') {
        action = 'reset_user_global';
      } else if (arg1) {
        action = 'reset_user';
        targetArgStartIndex = 1;
      }
    }

    // ── HELP PANEL ───────────────────────────────────────────────────────────
    if (!action) {
      return reply(
        embed(
          `${gEmoji('settings', '⚙️')}Developer XP & Database Control Panel`,
          [
            '**User Reset Commands:**',
            `• \`${p}xpcontrol reset user <@user|userID>\` — Reset XP & stats for a single user`,
            `• \`${p}xpcontrol reset user global\` — Reset XP & stats for **ALL users** globally`,
            '',
            '**Server/Guild Reset Commands:**',
            `• \`${p}xpcontrol reset guild [guildID]\` — Reset listening time & stats for a single server`,
            `• \`${p}xpcontrol reset global guild\` — Reset listening time & stats for **ALL servers** globally`,
            '',
            '**XP Adjustments:**',
            `• \`${p}xpcontrol add <@user> <amount>\` — Add XP to a user`,
            `• \`${p}xpcontrol remove <@user> <amount>\` — Remove XP from a user`,
            '',
            `**Shortcuts:** \`${p}resetuser <@user>\`, \`${p}resetuserglobal\`, \`${p}resetguild [guildID]\`, \`${p}resetglobalguild\``,
          ].join('\n'),
          BLUE,
        ),
      );
    }

    // ── 1. RESET GLOBAL USER ─────────────────────────────────────────────────
    if (action === 'reset_user_global') {
      try {
        const count = await userRepo.resetGlobalXP();
        return reply(
          embed(
            `${gEmoji('success', '✅')}Global User Reset Successful`,
            `${gEmoji('success', '✅')}Successfully reset XP, Level, and statistics to **0 (Level 1)** for **${count}** users in the database!`,
            GREEN,
          ),
        );
      } catch (err) {
        return reply(
          embed(
            `${gEmoji('error', '❌')}Global User Reset Failed`,
            `An error occurred while resetting global user stats: ${errText(err)}`,
            RED,
          ),
        );
      }
    }

    // ── 2. RESET GLOBAL GUILD ────────────────────────────────────────────────
    if (action === 'reset_guild_global') {
      try {
        const count = await guildRepo.resetGlobalGuildStats();
        return reply(
          embed(
            `${gEmoji('success', '✅')}Global Guild Reset Successful`,
            `${gEmoji('success', '✅')}Successfully reset total listening seconds, songs played, and command stats to **0** for **${count}** guilds in the database!`,
            GREEN,
          ),
        );
      } catch (err) {
        return reply(
          embed(
            `${gEmoji('error', '❌')}Global Guild Reset Failed`,
            `An error occurred while resetting global guild stats: ${errText(err)}`,
            RED,
          ),
        );
      }
    }

    // ── 3. RESET PER GUILD ───────────────────────────────────────────────────
    if (action === 'reset_guild') {
      let targetGuildId = args[targetArgStartIndex]?.trim() || message.guild?.id;

      if (!targetGuildId || !/^\d{17,20}$/.test(targetGuildId)) {
        targetGuildId = message.guild?.id;
      }

      if (!targetGuildId) {
        return replyTemp(
          embed(
            `${gEmoji('error', '❌')}Guild Required`,
            `Please run this command inside a server or specify a valid numeric Guild ID (e.g. \`${p}resetguild 123456789012345678\`)!`,
            RED,
          ),
        );
      }

      try {
        await guildRepo.resetGuildStats(targetGuildId);
        const cachedGuild = client.guilds.cache.get(targetGuildId);
        const guildName = md(cachedGuild?.name || `Server (${targetGuildId})`);

        return reply(
          embed(
            `${gEmoji('success', '✅')}Guild Reset Successful`,
            `${gEmoji('success', '✅')}Successfully reset all listening time and statistics for server **${guildName}** (${code(targetGuildId)}) to **0**!`,
            GREEN,
          ),
        );
      } catch (err) {
        return reply(
          embed(
            `${gEmoji('error', '❌')}Guild Reset Failed`,
            `An error occurred while resetting guild stats: ${errText(err)}`,
            RED,
          ),
        );
      }
    }

    // ── TARGET USER RESOLUTION FOR PER-USER COMMANDS ─────────────────────────
    let targetUser = message.mentions?.users?.first() || null;
    const rawUserArg = args[targetArgStartIndex]?.replace(/[<@!>]/g, '').trim();

    if (!targetUser && rawUserArg && /^\d{17,20}$/.test(rawUserArg)) {
      targetUser = await client.users.fetch(rawUserArg).catch(() => null);
      if (!targetUser) {
        const dbUser = await userRepo.getUser(rawUserArg).catch(() => null);
        if (dbUser && dbUser.discordId) {
          targetUser = {
            id: dbUser.discordId,
            username: `User_${dbUser.discordId.slice(-4)}`,
            bot: false,
          };
        }
      }
    }

    if (!targetUser) {
      return replyTemp(
        embed(
          `${gEmoji('error', '❌')}User Required`,
          'Please mention a valid user (`@User`) or provide a valid numeric User ID!',
          RED,
        ),
      );
    }

    if (targetUser.bot) {
      return replyTemp(
        embed(
          `${gEmoji('error', '❌')}Invalid Target: Bot Account`,
          `${gEmoji('robot', '🤖')}**Bot accounts do not gain XP or have level profiles!**`,
          RED,
        ),
        8000,
      );
    }

    const userId = targetUser.id;
    const displayName = md(targetUser.username, 64);

    // ── 4. RESET PER USER ────────────────────────────────────────────────────
    if (action === 'reset_user') {
      try {
        await userRepo.resetUserXP(userId);
        return reply(
          embed(
            `${gEmoji('success', '✅')}User XP Reset`,
            `Successfully reset XP, Level, and listening statistics for **${displayName}** to **0 (Level 1)**!`,
            GREEN,
          ),
        );
      } catch (err) {
        return reply(embed(`${gEmoji('error', '❌')}Failed to Reset User`, errText(err), RED));
      }
    }

    // ── 5 & 6. ADD / REMOVE XP ───────────────────────────────────────────────
    if (action === 'add' || action === 'remove') {
      const isAdd = action === 'add';
      const amount = parseInt(args[targetArgStartIndex + 1], 10);

      if (isNaN(amount) || amount <= 0) {
        return replyTemp(
          embed(
            `${gEmoji('error', '❌')}Invalid Amount`,
            `Please specify a positive numeric XP amount to ${isAdd ? 'add' : 'remove'}. Example: \`${p}${isAdd ? 'addxp' : 'removexp'} @User ${isAdd ? 500 : 200}\``,
            RED,
          ),
        );
      }

      try {
        if (isAdd) {
          const res = await userRepo.addXPToUser(userId, amount);
          const levelMsg = res.leveledUp
            ? ` ${gEmoji('level_up', '🎉')}**Leveled Up!** (Level ${res.oldLevel} ➔ **Level ${res.newLevel}**)`
            : ` (Level ${res.newLevel})`;

          return reply(
            embed(
              `${gEmoji('success', '✅')}XP Added`,
              `Added **+${amount.toLocaleString()} XP** to **${displayName}**!${levelMsg}\n\n• **Total XP:** ${code(`${res.newXP.toLocaleString()} XP`)}`,
              GREEN,
            ),
          );
        }

        const res = await userRepo.removeXPFromUser(userId, amount);
        return reply(
          embed(
            `${gEmoji('success', '✅')}XP Removed`,
            `Removed **-${amount.toLocaleString()} XP** from **${displayName}**!\n\n• **Remaining XP:** ${code(`${res.newXP.toLocaleString()} XP`)}\n• **Current Level:** Level ${code(res.newLevel)}`,
            ORANGE,
          ),
        );
      } catch (err) {
        return reply(
          embed(`${gEmoji('error', '❌')}Failed to ${isAdd ? 'Add' : 'Remove'} XP`, errText(err), RED),
        );
      }
    }
  },
};
  