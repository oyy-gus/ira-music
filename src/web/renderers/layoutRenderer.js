'use strict';

const fs = require('fs');
const path = require('path');
const config = require('../../config');

const layoutHtmlPath = path.join(__dirname, '../html/layout.html');
const layoutTemplate = fs.readFileSync(layoutHtmlPath, 'utf8');

const renderLayout = (client, user, activePage, title, bodyContent) => {
  const botUser = client?.user || {};
  const botName = botUser.displayName || botUser.username || 'IRA Music';
  const botAvatar = botUser.displayAvatarURL
    ? botUser.displayAvatarURL({ extension: 'png', size: 512 })
    : 'https://cdn.discordapp.com/embed/avatars/0.png';

  const navItems = [
    { href: '/',              label: 'Home',            icon: 'fa-house',      key: 'home' },
    { href: '/features',      label: 'Features',        icon: 'fa-stars',      key: 'features' },
    { href: '/commands',      label: 'Commands',        icon: 'fa-terminal',   key: 'commands' },
    { href: '/leaderboard',   label: 'Leaderboard',     icon: 'fa-trophy',     key: 'leaderboard' },
    { href: '/members',       label: 'Community',       icon: 'fa-users',      key: 'members' },
    { href: '/nowplaying',    label: 'Now Playing',     icon: 'fa-headphones', key: 'nowplaying' },
    { href: '/status',        label: 'Cluster',         icon: 'fa-server',     key: 'status' },
    { href: '/botstats',      label: 'Stats',           icon: 'fa-chart-bar',  key: 'botstats' },
    { href: '/servers',       label: 'Server Settings', icon: 'fa-sliders',    key: 'servers' },
  ];

  const userHtml = user
    ? `<div class="user-badge"><img src="${user.avatar_url}" alt="${user.username}" class="user-avatar" /><span class="user-name">${user.global_name || user.username}</span><a href="/auth/discord/logout" class="btn btn-sm btn-outline" style="padding:0;width:28px;height:28px;display:inline-flex;align-items:center;justify-content:center;border-radius:8px;flex-shrink:0"><i class="fa-solid fa-right-from-bracket" style="font-size:.8rem"></i></a></div>`
    : `<a href="/auth/discord/login" class="btn btn-discord"><i class="fa-brands fa-discord"></i> Login</a>`;

  const navHtml = navItems.map((n) => `<li><a href="${n.href}" class="nav-link${activePage === n.key ? ' active' : ''}"><i class="fa-solid ${n.icon}"></i>${n.label}</a></li>`).join('');

  const metaDesc = `${botName} — High-fidelity Discord Music Bot streaming from YouTube and SoundCloud with multi-node failover, XP progression, and live web dashboard.`;
  const inviteUrl = `https://discord.com/oauth2/authorize?client_id=${client?.user?.id || ''}&permissions=8&scope=bot%20applications.commands`;

  return layoutTemplate
    .replace(/\{\{TITLE\}\}/g, title)
    .replace(/\{\{BOT_NAME\}\}/g, botName)
    .replace(/\{\{META_DESC\}\}/g, metaDesc)
    .replace(/\{\{BOT_AVATAR\}\}/g, botAvatar)
    .replace(/\{\{USER_HTML\}\}/g, userHtml)
    .replace(/\{\{NAV_HTML\}\}/g, navHtml)
    .replace(/\{\{INVITE_URL\}\}/g, inviteUrl)
    .replace(/\{\{BODY_CONTENT\}\}/g, bodyContent)
    .replace(/\{\{YEAR\}\}/g, new Date().getFullYear());
};

module.exports = renderLayout;
