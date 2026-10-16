const { EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder } = require('discord.js');
const LeaderboardService = require('../../services/leaderboardService');
const SeasonService = require('../../services/seasonService');
const { formatDurationText } = require('../../utils/timeUtils');
const { calculateProgression } = require('../../services/xpService');
const { getEmoji, getEmojiComponent } = require('../../config/emojis');

const buildLeaderboardEmbed = async (mode, guild, callerUser, client) => {
  const e = (key, fallback) => getEmoji(key, fallback, client);
  const eSpace = (key, fallback) => {
    const val = e(key, fallback);
    return val ? `${val} ` : '';
  };
  const botExclude = [client?.user?.id].filter(Boolean);

  const medals = [
    e('medal_1', '🥇'),
    e('medal_2', '🥈'),
    e('medal_3', '🥉'),
    '4.', '5.', '6.', '7.', '8.', '9.', '🔟',
  ];

  const embed = new EmbedBuilder().setColor(0x5865F2);
  const currentSeason = SeasonService.getCurrentSeason();

  const botName = (client?.user?.displayName || client?.user?.username || 'BOT').toUpperCase();

  if (mode === 'global_servers') {
    const rawServers = await LeaderboardService.getGlobalServerLeaderboard(10, client);
    const servers = (rawServers || []).filter((s) => (s.totalListeningSeconds || 0) > 0);
    const titleEmoji = eSpace('global_servers', e('globe', '🌎'));
    embed.setTitle(`${titleEmoji}${botName} GLOBAL SERVERS`);

    if (servers.length === 0) {
      embed.setDescription('No server listening data recorded yet.');
    } else {
      const lines = servers.map((s, idx) => {
        const medal = medals[idx] || `${idx + 1}.`;
        const timeStr = formatDurationText(s.totalListeningSeconds || 0, { isSeconds: true });
        // Resolve guild name: live Discord cache → stored field → fallback ID
        const cachedGuild = client?.guilds?.cache?.get(s.guildId);
        const name = cachedGuild?.name || s.guildName || `Server (${s.guildId})`;
        const memberCount = cachedGuild?.memberCount ? ` • ${cachedGuild.memberCount.toLocaleString()} members` : '';
        return `${medal} **${name}**${memberCount}\n   \`${timeStr}\``;
      });
      embed.setDescription(lines.join('\n\n'));
    }
  } else if (mode === 'server_users') {
    const guildId = guild?.id;
    const users = await LeaderboardService.getServerUserLeaderboard(guildId, 10, botExclude);
    const titleEmoji = eSpace('server_users', e('trophy', '🏆'));
    embed.setTitle(`${titleEmoji}${guild?.name || 'SERVER'} LISTENERS`);

    if (users.length === 0) {
      embed.setDescription('No listener data recorded in this server yet.');
    } else {
      const lines = users.map((u, idx) => {
        const medal = medals[idx] || `${idx + 1}.`;
        const prog = calculateProgression(u.xp || 0);
        const timeStr = formatDurationText(u.guildListeningSeconds || 0, { isSeconds: true });
        return `${medal} <@${u.discordId}>\n   Lv. ${prog.level} • \`${timeStr}\``;
      });

      // Caller position
      const callerId = callerUser.id;
      const callerInTop = users.some((u) => u.discordId === callerId);
      if (!callerInTop) {
        const ranks = await LeaderboardService.getUserRanks(callerId, guildId);
        const callerUserDoc = users.find((u) => u.discordId === callerId);
        const prog = calculateProgression(callerUserDoc?.xp || 0);
        const timeStr = formatDurationText(callerUserDoc?.guildListeningSeconds || 0, { isSeconds: true });
        const userEmoji = eSpace('user', '👤');
        lines.push(`\n━━━━━━━━━━━━━━━━━━━━\n${userEmoji}**YOUR POSITION**\n#${ranks.serverRank} <@${callerId}>\nLv. ${prog.level} • \`${timeStr}\``);
      }
      embed.setDescription(lines.join('\n\n'));
    }
  } else if (mode === 'season_users') {
    const users = await LeaderboardService.getGlobalUserLeaderboard(10, botExclude);
    const titleEmoji = eSpace('season_users', e('season', '🌟'));
    embed.setTitle(`${titleEmoji}${currentSeason.name.toUpperCase()} LEADERBOARD`);
    embed.setFooter({ text: `Season ID: ${currentSeason.seasonId} • Ends at ${currentSeason.endAt.toISOString().split('T')[0]}` });

    if (users.length === 0) {
      embed.setDescription('No seasonal listening data recorded yet.');
    } else {
      const lines = users.map((u, idx) => {
        const medal = medals[idx] || `${idx + 1}.`;
        const prog = calculateProgression(u.xp || 0);
        const timeStr = formatDurationText(u.statistics?.timeListenedSeconds || 0, { isSeconds: true });
        return `${medal} <@${u.discordId}>\n   Lv. ${prog.level} • \`${timeStr}\``;
      });
      embed.setDescription(lines.join('\n\n'));
    }
  } else {
    // Global Users (default)
    const users = await LeaderboardService.getGlobalUserLeaderboard(10, botExclude);
    const titleEmoji = eSpace('global_users', e('globe', '🌎'));
    embed.setTitle(`${titleEmoji}${botName} GLOBAL LISTENERS`);

    if (users.length === 0) {
      embed.setDescription('No global listening data recorded yet.');
    } else {
      const lines = users.map((u, idx) => {
        const medal = medals[idx] || `${idx + 1}.`;
        const prog = calculateProgression(u.xp || 0);
        const timeStr = formatDurationText(u.statistics?.timeListenedSeconds || 0, { isSeconds: true });
        return `${medal} <@${u.discordId}>\n   Lv. ${prog.level} • \`${timeStr}\``;
      });
      embed.setDescription(lines.join('\n\n'));
    }
  }

  return embed;
};

const getActionRow = (currentMode, client) => {
  const options = [
    {
      label: 'Global Listeners',
      value: 'global_users',
      description: 'Top listeners across all servers',
      emoji: getEmojiComponent('global_users', '🌎', client) || getEmojiComponent('globe', '🌎', client),
      default: currentMode === 'global_users',
    },
    {
      label: 'Global Servers',
      value: 'global_servers',
      description: 'Top servers by listening time',
      emoji: getEmojiComponent('global_servers', '🖥️', client) || getEmojiComponent('server', '🖥️', client),
      default: currentMode === 'global_servers',
    },
    {
      label: 'Server Listeners',
      value: 'server_users',
      description: 'Top listeners in current server',
      emoji: getEmojiComponent('server_users', '🏆', client) || getEmojiComponent('trophy', '🏆', client),
      default: currentMode === 'server_users',
    },
    {
      label: 'Season Leaderboard',
      value: 'season_users',
      description: 'Current season rankings',
      emoji: getEmojiComponent('season_users', '🌟', client) || getEmojiComponent('season', '🌟', client),
      default: currentMode === 'season_users',
    },
  ];

  const selectMenu = new StringSelectMenuBuilder()
    .setCustomId('lb_select')
    .setPlaceholder('Select Leaderboard View...')
    .addOptions(options);

  return new ActionRowBuilder().addComponents(selectMenu);
};

module.exports = {
  name: 'leaderboard',
  description: 'View global top listeners, global top servers, seasonal, or current server rankings',
  aliases: ['lb', 'top', 'ranking'],
  category: 'utility',
  cooldown: 5,
  async execute({ message, args, client }) {
    let mode = 'global_users';
    const sub = (args[0] || '').toLowerCase();
    if (sub === 'server' || sub === 'guild') mode = 'server_users';
    else if (sub === 'servers' || sub === 'topservers') mode = 'global_servers';
    else if (sub === 'season' || sub === 'seasonal') mode = 'season_users';

    const embed = await buildLeaderboardEmbed(mode, message.guild, message.author, client);
    const row = getActionRow(mode, client);

    const msg = await message.reply({ embeds: [embed], components: [row] });

    // Interactive dropdown collector
    const collector = msg.createMessageComponentCollector({
      filter: (i) => i.user.id === message.author.id,
      time: 60000,
    });

    collector.on('collect', async (interaction) => {
      if (interaction.customId === 'lb_select') {
        mode = interaction.values[0];
        const newEmbed = await buildLeaderboardEmbed(mode, message.guild, message.author, client);
        const newRow = getActionRow(mode, client);
        await interaction.update({ embeds: [newEmbed], components: [newRow] });
      }
    });

    collector.on('end', () => {
      msg.edit({ components: [] }).catch(() => {});
    });
  },
};
