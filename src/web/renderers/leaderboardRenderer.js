'use strict';

const fs = require('fs');
const path = require('path');
const renderLayout = require('./layoutRenderer');

const htmlPath = path.join(__dirname, '../html/leaderboard.html');
const tpl = fs.readFileSync(htmlPath, 'utf8');

const escapeHtml = (str) => {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
};

const renderLeaderboard = async (client, user) => {
  let userRows = '';
  let serverRows = '';

  try {
    const LeaderboardService = require('../../services/leaderboardService');
    const botId = client?.user?.id;
    const excludeIds = [botId, 'autoplay', 'null', 'undefined', null, undefined].filter(Boolean);

    const topUsersRaw = await LeaderboardService.getGlobalUserLeaderboard(100, excludeIds);

    const validUsers = (topUsersRaw || []).filter(u => {
      if (!u || !u.discordId) return false;
      const strId = String(u.discordId).trim().toLowerCase();
      if (!strId || strId === 'null' || strId === 'undefined' || strId === 'autoplay') return false;
      if (botId && strId === String(botId).toLowerCase()) return false;
      return (u.statistics?.timeListenedSeconds || 0) > 0;
    });

    const renderedUserList = (await Promise.all(validUsers.map(async (u) => {
      let cachedUser = client?.users?.cache?.get(u.discordId);
      if (!cachedUser && client?.users?.fetch && /^\d+$/.test(u.discordId)) {
        cachedUser = await client.users.fetch(u.discordId).catch(() => null);
      }

      if (cachedUser?.bot) return null;

      const rawName = cachedUser ? (cachedUser.globalName || cachedUser.username) : `User (${u.discordId})`;
      const displayName = escapeHtml(rawName);
      const tag = escapeHtml(cachedUser?.username ? `@${cachedUser.username}` : `ID: ${u.discordId}`);
      const avatarUrl = cachedUser?.displayAvatarURL
        ? cachedUser.displayAvatarURL({ extension: 'png', size: 128 })
        : `https://cdn.discordapp.com/embed/avatars/${parseInt(u.discordId || '0') % 6}.png`;

      return {
        ...u,
        displayName,
        tag,
        avatarUrl
      };
    }))).filter(Boolean).slice(0, 50);

    if (renderedUserList.length === 0) {
      userRows = '<tr><td colspan="5" style="text-align:center;color:var(--muted);padding:40px">No listener data recorded yet.</td></tr>';
    } else {
      userRows = renderedUserList.map((u, i) => {
        const rank = i + 1;
        const rankClass = rank === 1 ? 'gold' : rank === 2 ? 'silver' : rank === 3 ? 'bronze' : '';
        const rankIcon = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : rank;
        const hrs = Math.floor((u.statistics?.timeListenedSeconds || 0) / 3600);
        const mins = Math.floor(((u.statistics?.timeListenedSeconds || 0) % 3600) / 60);
        const timeStr = hrs > 0 ? `${hrs}h ${mins}m` : `${mins}m`;

        return `<tr>
          <td><span class="tbl-rank ${rankClass}">${rankIcon}</span></td>
          <td>
            <div class="user-row">
              <img src="${u.avatarUrl}" alt="" onerror="this.src='https://cdn.discordapp.com/embed/avatars/0.png'" />
              <div>
                <div class="user-row-name">${u.displayName}</div>
                <div class="user-row-sub">${u.tag} • Level ${u.level || 1}</div>
              </div>
            </div>
          </td>
          <td><span style="font-family:var(--ff-title);font-weight:700">${(u.xp || 0).toLocaleString()}</span></td>
          <td>${timeStr}</td>
          <td><span style="font-family:var(--ff-title);font-weight:700">${(u.statistics?.songsPlayed || 0).toLocaleString()}</span></td>
        </tr>`;
      }).join('');
    }
  } catch (err) {
    userRows = `<tr><td colspan="5" style="text-align:center;color:var(--red);padding:40px"><i class="fa-solid fa-triangle-exclamation"></i> Failed to load user leaderboard: ${err.message}</td></tr>`;
  }

  try {
    const LeaderboardService = require('../../services/leaderboardService');
    const topGuildsRaw = await LeaderboardService.getGlobalServerLeaderboard(100, client);

    const validGuilds = (topGuildsRaw || []).filter(g => {
      if (!g || !g.guildId) return false;
      const strId = String(g.guildId).trim().toLowerCase();
      if (!strId || strId === 'null' || strId === 'undefined') return false;
      const secs = g.totalListeningSeconds || g.statistics?.totalListeningSeconds || 0;
      return secs > 0;
    }).slice(0, 50);

    if (validGuilds.length === 0) {
      serverRows = '<tr><td colspan="5" style="text-align:center;color:var(--muted);padding:40px">No server listening data recorded yet.</td></tr>';
    } else {
      serverRows = validGuilds.map((g, i) => {
        const rank = i + 1;
        const rankClass = rank === 1 ? 'gold' : rank === 2 ? 'silver' : rank === 3 ? 'bronze' : '';
        const rankIcon = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : rank;
        const totalSecs = g.totalListeningSeconds || g.statistics?.totalListeningSeconds || 0;
        const hrs = Math.floor(totalSecs / 3600);
        const mins = Math.floor((totalSecs % 3600) / 60);
        const timeStr = hrs > 0 ? `${hrs}h ${mins}m` : `${mins}m`;

        const cachedGuild = client?.guilds?.cache?.get(g.guildId);
        const serverName = escapeHtml(cachedGuild?.name || g.guildName || `Server (${g.guildId})`);
        const iconUrl = cachedGuild?.iconURL ? cachedGuild.iconURL({ extension: 'png', size: 128 }) : null;
        const subInfo = cachedGuild?.memberCount ? `${cachedGuild.memberCount.toLocaleString()} members` : `ID: ${g.guildId}`;

        const iconHtml = iconUrl
          ? `<img src="${iconUrl}" alt="" onerror="this.style.display='none'" />`
          : `<div style="width:32px;height:32px;border-radius:50%;background:rgba(88,101,242,.2);display:flex;align-items:center;justify-content:center;color:var(--primary);font-size:.8rem;font-weight:700"><i class="fa-brands fa-discord"></i></div>`;

        return `<tr>
          <td><span class="tbl-rank ${rankClass}">${rankIcon}</span></td>
          <td>
            <div class="user-row">
              ${iconHtml}
              <div>
                <div class="user-row-name">${serverName}</div>
                <div class="user-row-sub">${subInfo}</div>
              </div>
            </div>
          </td>
          <td>${timeStr}</td>
          <td><span style="font-family:var(--ff-title);font-weight:700">${(g.statistics?.songsPlayed || 0).toLocaleString()}</span></td>
          <td><span class="chip chip-blue">${(g.statistics?.commandsUsed || 0).toLocaleString()} cmds</span></td>
        </tr>`;
      }).join('');
    }
  } catch (err) {
    serverRows = `<tr><td colspan="5" style="text-align:center;color:var(--red);padding:40px"><i class="fa-solid fa-triangle-exclamation"></i> Failed to load server leaderboard: ${err.message}</td></tr>`;
  }

  const body = tpl
    .replace(/\{\{USER_ROWS\}\}/g, userRows)
    .replace(/\{\{SERVER_ROWS\}\}/g, serverRows);

  return renderLayout(client, user, 'leaderboard', 'Leaderboard', body);
};

module.exports = renderLeaderboard;
