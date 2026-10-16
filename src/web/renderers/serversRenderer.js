'use strict';

const fs = require('fs');
const path = require('path');
const renderLayout = require('./layoutRenderer');

const htmlPath = path.join(__dirname, '../html/servers.html');
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

const renderServers = async (client, user) => {
  if (!user) {
    const loginUrl = '/auth/discord/login';
    const body = `<div class="page" style="text-align:center;padding:80px 20px">
      <div class="card" style="max-width:480px;margin:0 auto;padding:40px 30px">
        <i class="fa-solid fa-lock" style="font-size:3rem;color:var(--primary);margin-bottom:20px"></i>
        <h2 style="font-family:var(--ff-title);font-size:1.5rem;font-weight:700;margin-bottom:10px">Server Settings</h2>
        <p style="color:var(--muted);margin-bottom:28px">Login with Discord to manage your Ira Music servers and configure Welcome & Leave messages.</p>
        <a href="${loginUrl}" class="btn btn-primary" style="display:inline-flex;align-items:center;gap:10px;padding:12px 28px;font-size:1rem;border-radius:12px">
          <i class="fa-brands fa-discord" style="font-size:1.2rem"></i> Login with Discord
        </a>
      </div>
    </div>`;
    return renderLayout(client, user, 'servers', 'Server Settings', body);
  }

  const clientGuilds = client?.guilds?.cache ? Array.from(client.guilds.cache.values()) : [];

  const serverCards = clientGuilds.map(g => {
    const iconUrl = g.iconURL({ dynamic: true, size: 128 }) || 'https://cdn.discordapp.com/embed/avatars/0.png';
    const memberCount = g.memberCount || 0;
    return `
      <div class="card" style="display:flex;align-items:center;justify-content:space-between;gap:16px;padding:20px">
        <div style="display:flex;align-items:center;gap:16px">
          <img src="${iconUrl}" alt="${escapeHtml(g.name)}" style="width:54px;height:54px;border-radius:16px;object-fit:cover;border:1px solid rgba(255,255,255,.1)">
          <div>
            <div style="font-family:var(--ff-title);font-weight:700;font-size:1.05rem;color:#fff">${escapeHtml(g.name)}</div>
            <div style="font-size:.8rem;color:var(--muted);margin-top:2px"><i class="fa-solid fa-users" style="margin-right:4px"></i>${memberCount} members</div>
          </div>
        </div>
        <a href="/servers/${g.id}" class="btn btn-primary" style="padding:8px 18px;font-size:.85rem;border-radius:10px">
          <i class="fa-solid fa-gear" style="margin-right:6px"></i> Manage
        </a>
      </div>`;
  }).join('');

  const serverContent = clientGuilds.length === 0 ? `
    <div class="card" style="text-align:center;padding:40px">
      <i class="fa-solid fa-server" style="font-size:2.5rem;color:var(--muted);margin-bottom:14px"></i>
      <div style="font-family:var(--ff-title);font-size:1.1rem;font-weight:700;margin-bottom:6px">No Servers Found</div>
      <p style="color:var(--muted);font-size:.9rem">Ira Music is currently not in any servers you manage, or server data is loading.</p>
    </div>` : `
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(320px,1fr));gap:16px">
      ${serverCards}
    </div>`;

  const body = tpl.replace(/\{\{SERVER_CONTENT\}\}/g, serverContent);
  return renderLayout(client, user, 'servers', 'Server Settings', body);
};

module.exports = renderServers;
