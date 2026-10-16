'use strict';

const fs = require('fs');
const path = require('path');
const renderLayout = require('./layoutRenderer');
const greetingService = require('../../services/greetingService');

const studioHtmlPath = path.join(__dirname, '../html/server-settings.html');
const hubHtmlPath = path.join(__dirname, '../html/server-hub.html');
const studioTpl = fs.readFileSync(studioHtmlPath, 'utf8');
const hubTpl = fs.readFileSync(hubHtmlPath, 'utf8');

const escapeHtml = (str) => {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
};

const renderServerSettings = async (client, user, guildId, section = 'overview') => {
  if (!user) {
    const loginUrl = '/auth/discord/login';
    const body = `<div class="page" style="text-align:center;padding:80px 20px">
      <div class="card" style="max-width:480px;margin:0 auto;padding:40px 30px">
        <i class="fa-solid fa-lock" style="font-size:3rem;color:var(--primary);margin-bottom:20px"></i>
        <h2 style="font-family:var(--ff-title);font-size:1.5rem;font-weight:700;margin-bottom:10px">Authentication Required</h2>
        <p style="color:var(--muted);margin-bottom:28px">You must log in with Discord to manage server settings.</p>
        <a href="${loginUrl}" class="btn btn-primary" style="display:inline-flex;align-items:center;gap:10px;padding:12px 28px;font-size:1rem;border-radius:12px">
          <i class="fa-brands fa-discord"></i> Login with Discord
        </a>
      </div>
    </div>`;
    return renderLayout(client, user, 'servers', 'Server Settings', body);
  }

  const guild = client?.guilds?.cache?.get(guildId);
  const guildName = guild ? guild.name : `Server #${guildId}`;
  const guildIcon = guild?.iconURL({ dynamic: true, size: 128 }) || 'https://cdn.discordapp.com/embed/avatars/0.png';
  const memberCount = guild?.memberCount || 0;

  if (section === 'welcome-leave') {
    const rawConfig = (await greetingService.getGreetingConfig(guildId)) || {};
    const userDisplayName = user?.global_name || user?.username || client?.user?.username || 'Ira Music';
    const userName = user?.username || 'iramusic';
    const userAvatar = user?.avatar_url || 'https://cdn.discordapp.com/embed/avatars/0.png';
    const botName = client?.user?.username || 'Ira Music';
    const botAvatar = client?.user?.avatarURL({ dynamic: true, size: 64 }) || 'https://cdn.discordapp.com/embed/avatars/0.png';

    const body = studioTpl
      .replace(/\{\{GUILD_ID\}\}/g, guildId)
      .replace(/\{\{GUILD_NAME\}\}/g, escapeHtml(guildName))
      .replace(/\{\{GUILD_ICON\}\}/g, guildIcon)
      .replace(/\{\{USER_DISPLAY_NAME\}\}/g, escapeHtml(userDisplayName))
      .replace(/\{\{USER_NAME\}\}/g, escapeHtml(userName))
      .replace(/\{\{USER_AVATAR\}\}/g, escapeHtml(userAvatar))
      .replace(/\{\{BOT_NAME\}\}/g, escapeHtml(botName))
      .replace(/\{\{BOT_AVATAR\}\}/g, escapeHtml(botAvatar))
      .replace(/\{\{GREETING_JSON\}\}/g, JSON.stringify(rawConfig).replace(/</g, '\\u003c'));

    return renderLayout(client, user, 'servers', `${guildName} &bull; Welcome & Leave Studio`, body);
  }

  // Server Management Hub (Module Overview)
  const body = hubTpl
    .replace(/\{\{GUILD_ID\}\}/g, guildId)
    .replace(/\{\{GUILD_NAME\}\}/g, escapeHtml(guildName))
    .replace(/\{\{GUILD_ICON\}\}/g, guildIcon)
    .replace(/\{\{MEMBER_COUNT\}\}/g, memberCount.toLocaleString());

  return renderLayout(client, user, 'servers', `${guildName} Settings Hub`, body);
};

module.exports = renderServerSettings;

