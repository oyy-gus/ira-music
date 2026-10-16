'use strict';

const fs = require('fs');
const path = require('path');
const renderLayout = require('./layoutRenderer');
const config = require('../../config');

const htmlPath = path.join(__dirname, '../html/home.html');
const tpl = fs.readFileSync(htmlPath, 'utf8');

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
}[c]));

const fmtUptime = (sec) => {
  const d = Math.floor(sec / 86400);
  const h = Math.floor((sec % 86400) / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const parts = [];
  if (d > 0) parts.push(`${d}d`);
  if (h > 0) parts.push(`${h}h`);
  parts.push(`${m}m`);
  return parts.join(' ');
};

const renderHome = (client, user, getNowPlayingList) => {
  const botUser = client?.user || {};
  const botName = botUser.displayName || botUser.username || 'IRA Music';
  const botAvatar = botUser.displayAvatarURL
    ? botUser.displayAvatarURL({ extension: 'png', size: 256 })
    : 'https://cdn.discordapp.com/embed/avatars/0.png';
  const guildCount = client?.guilds?.cache?.size || 0;
  const activePlayers = client?.lavalink?.players?.size || 0;
  const uptime = fmtUptime(Math.floor(process.uptime()));
  const nodeCount = (config.lavalink?.nodes || []).length;
  const nowPlaying = typeof getNowPlayingList === 'function' ? getNowPlayingList(client) : [];
  const activeStreams = nowPlaying.filter((np) => np.track && np.playing);

  const recentNP = activeStreams.slice(0, 3).map((np) => `
    <div class="card card-sm" style="display:flex;align-items:center;gap:14px;min-width:0;overflow:hidden">
      ${np.track?.thumbnail
        ? `<img src="${esc(np.track.thumbnail)}" alt="" style="width:52px;height:52px;border-radius:10px;object-fit:cover;flex-shrink:0" />`
        : `<div style="width:52px;height:52px;border-radius:10px;background:rgba(88,101,242,.15);display:flex;align-items:center;justify-content:center;flex-shrink:0"><i class="fa-solid fa-music" style="color:var(--primary)"></i></div>`}
      <div style="min-width:0;flex:1">
        <div style="font-weight:700;font-size:.92rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(np.track?.title || 'Unknown Track')}</div>
        <div style="font-size:.78rem;color:var(--muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(np.guildName)} · ${esc(np.track?.author || 'Unknown Artist')}</div>
      </div>
      <div class="np-wave" style="margin-left:auto;flex-shrink:0"><span></span><span></span><span></span><span></span><span></span></div>
    </div>
  `).join('');

  const recentSection = activeStreams.length > 0 ? `
    <div style="margin-bottom:48px">
      <h2 style="font-family:var(--ff-title);font-size:1.3rem;font-weight:700;margin-bottom:16px;display:flex;align-items:center;gap:10px">
        <i class="fa-solid fa-music" style="color:var(--primary)"></i>Currently Streaming
        <span class="chip chip-green" style="font-size:.7rem">${activeStreams.length} server${activeStreams.length > 1 ? 's' : ''}</span>
      </h2>
      <div style="display:grid;grid-template-columns:minmax(0,1fr);gap:12px">${recentNP}</div>
      ${activeStreams.length > 3 ? `<div style="text-align:center;margin-top:14px"><a href="/nowplaying" class="btn btn-secondary btn-sm">View all ${activeStreams.length} streams <i class="fa-solid fa-arrow-right"></i></a></div>` : ''}
    </div>` : '';

  const inviteUrl = `https://discord.com/oauth2/authorize?client_id=${client?.user?.id || ''}&permissions=8&scope=bot%20applications.commands`;
  const supportUrl = config.discord?.supportServerUrl || '#';

  const body = tpl
    .replace(/\{\{BOT_NAME\}\}/g, esc(botName))
    .replace(/\{\{BOT_AVATAR\}\}/g, botAvatar)
    .replace(/\{\{GUILD_COUNT\}\}/g, String(guildCount))
    .replace(/\{\{ACTIVE_PLAYERS\}\}/g, String(activePlayers))
    .replace(/\{\{NODE_COUNT\}\}/g, String(nodeCount))
    .replace(/\{\{UPTIME\}\}/g, uptime)
    .replace(/\{\{INVITE_URL\}\}/g, inviteUrl)
    .replace(/\{\{SUPPORT_URL\}\}/g, supportUrl)
    .replace(/\{\{RECENT_STREAMING_SECTION\}\}/g, () => recentSection);

  return renderLayout(client, user, 'home', 'Home', body);
};

module.exports = renderHome;
