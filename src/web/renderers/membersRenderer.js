'use strict';

const fs = require('fs');
const path = require('path');
const renderLayout = require('./layoutRenderer');
const atlantisService = require('../../services/atlantis/atlantisService');

const membersHtmlPath = path.join(__dirname, '../html/members.html');
const membersTpl = fs.readFileSync(membersHtmlPath, 'utf8');

const memberDetailHtmlPath = path.join(__dirname, '../html/member-detail.html');
const memberDetailTpl = fs.readFileSync(memberDetailHtmlPath, 'utf8');

const escapeHtml = (str) => {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
};

const formatMinTime = (owos) => {
  const count = Number(owos) || 0;
  const totalSec = count * 10;
  const days = Math.floor(totalSec / 86400);
  const hours = Math.floor((totalSec % 86400) / 3600);
  const mins = Math.floor((totalSec % 3600) / 60);
  const secs = totalSec % 60;

  const parts = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (mins > 0) parts.push(`${mins}m`);
  parts.push(`${secs}s`);
  return parts.join(' ');
};

const getLevelBadge = (level) => {
  if (level === 3) {
    return `<span style="display:inline-flex;align-items:center;gap:4px;padding:3px 8px;border-radius:6px;font-size:.75rem;font-weight:600;background:rgba(59,130,246,0.18);color:#60A5FA;border:1px solid rgba(59,130,246,0.35)"><i class="fa-solid fa-shield"></i> Admin / Mod</span>`;
  }
  if (level === 2) {
    return `<span style="display:inline-flex;align-items:center;gap:4px;padding:3px 8px;border-radius:6px;font-size:.75rem;font-weight:600;background:rgba(245,158,11,0.18);color:#FBBF24;border:1px solid rgba(245,158,11,0.35)"><i class="fa-solid fa-gem"></i> Booster</span>`;
  }
  return `<span style="display:inline-flex;align-items:center;gap:4px;padding:3px 8px;border-radius:6px;font-size:.75rem;font-weight:600;background:rgba(255,255,255,0.08);color:var(--muted);border:1px solid var(--border)"><i class="fa-solid fa-user"></i> Member</span>`;
};

const getHitReqBadge = (owosCount, hitreq) => {
  if (hitreq === '⚠️') {
    return `<span style="display:inline-flex;align-items:center;gap:4px;padding:3px 8px;border-radius:6px;font-size:.75rem;font-weight:600;background:rgba(245,158,11,0.18);color:#FBBF24;border:1px solid rgba(245,158,11,0.35)">⚠️ Excused</span>`;
  }
  const passed = (owosCount || 0) >= 50 || hitreq === '✔️';
  if (passed) {
    return `<span style="display:inline-flex;align-items:center;gap:4px;padding:3px 8px;border-radius:6px;font-size:.75rem;font-weight:600;background:rgba(16,185,129,0.18);color:#34D399;border:1px solid rgba(16,185,129,0.35)"><i class="fa-solid fa-check"></i> Hit Requirement</span>`;
  }
  return `<span style="display:inline-flex;align-items:center;gap:4px;padding:3px 8px;border-radius:6px;font-size:.75rem;font-weight:600;background:rgba(239,68,68,0.18);color:#F87171;border:1px solid rgba(239,68,68,0.35)"><i class="fa-solid fa-xmark"></i> Did Not Hit (50 req)</span>`;
};

const pageMembers = async (client, user, guildId = null) => {
  const activeGuildId = guildId && guildId !== 'all' ? guildId : null;
  const { aotw, members } = await atlantisService.getMembersLeaderboard(activeGuildId);
  const totalCount = (aotw.length || 0) + (members.length || 0);

  // Guild scope label and dropdown options
  const clientGuilds = client?.guilds?.cache ? Array.from(client.guilds.cache.values()) : [];
  const currentGuild = activeGuildId ? clientGuilds.find((g) => g.id === activeGuildId) : null;
  const scopeLabel = currentGuild ? escapeHtml(currentGuild.name) : 'Global Community (All Servers)';

  let serverOptions = `<option value="all" ${!activeGuildId ? 'selected' : ''}>🌐 All Servers (Global Community)</option>`;
  for (const g of clientGuilds) {
    serverOptions += `<option value="${g.id}" ${activeGuildId === g.id ? 'selected' : ''}>🏰 ${escapeHtml(g.name)}</option>`;
  }

  // Calculate current week date label
  const date = new Date();
  const startDay = new Date(date);
  startDay.setDate(date.getDate() - date.getDay());
  const endDay = new Date(startDay);
  endDay.setDate(startDay.getDate() + 6);
  const weekDateLabel = `Week of ${startDay.getMonth() + 1}/${startDay.getDate()} - ${endDay.getMonth() + 1}/${endDay.getDate()}`;

  // Render AOTW Cards (Top 3)
  const podiumColors = [
    { border: '#F59E0B', glow: 'rgba(245,158,11,0.25)', label: '1st AOTW', icon: 'fa-trophy', color: '#FCD34D' },
    { border: '#94A3B8', glow: 'rgba(148,163,184,0.25)', label: '2nd AOTW', icon: 'fa-medal', color: '#CBD5E1' },
    { border: '#D97706', glow: 'rgba(217,119,6,0.25)', label: '3rd AOTW', icon: 'fa-award', color: '#FBBF24' },
  ];

  let aotwCards = '';
  if (!aotw || aotw.length === 0) {
    aotwCards = `<div style="grid-column:1/-1;text-align:center;padding:30px;color:var(--muted);background:rgba(255,255,255,.02);border-radius:14px;border:1px dashed var(--border)">No AOTW activity recorded for this scope yet. Start using OwO commands in your server!</div>`;
  } else {
    aotwCards = aotw
      .map((m, idx) => {
        const pod = podiumColors[idx] || podiumColors[0];
        const pfp = m.avatar || `https://cdn.discordapp.com/embed/avatars/${parseInt(m.userId || '0') % 5}.png`;
        const booster = m.premium
          ? `<span title="Server Booster" style="color:#EC4899;margin-left:4px"><i class="fa-solid fa-gem"></i></span>`
          : '';
        const levelBadge = getLevelBadge(m.level);
        const hitBadge = getHitReqBadge(m.owosPastWeek);
        const serverBadge = !activeGuildId && m.serverCount && m.serverCount > 1
          ? `<div style="font-size:.72rem;color:var(--primary);margin-top:2px"><i class="fa-solid fa-earth-americas"></i> ${m.serverCount} Servers</div>`
          : (m.guildName ? `<div style="font-size:.72rem;color:var(--primary);margin-top:2px"><i class="fa-solid fa-server"></i> ${escapeHtml(m.guildName)}</div>` : '');

        return `
        <a href="/members/${m.userId}${activeGuildId ? '?guildId=' + activeGuildId : ''}" class="card aotw-card" style="text-decoration:none;padding:20px;border-radius:16px;border:1px solid ${pod.border};background:linear-gradient(145deg, rgba(16,20,44,0.85), ${pod.glow});transition:all .25s ease;display:flex;flex-direction:column;gap:12px;position:relative;overflow:hidden">
          <div style="display:flex;align-items:center;justify-content:space-between">
            <span style="font-size:.78rem;font-weight:700;color:${pod.color};text-transform:uppercase;letter-spacing:.5px;display:flex;align-items:center;gap:6px">
              <i class="fa-solid ${pod.icon}"></i> ${pod.label}
            </span>
            <span style="font-size:1.1rem;font-weight:800;color:#fff">${m.owosPastWeek} owos</span>
          </div>
          <div style="display:flex;align-items:center;gap:12px">
            <img src="${pfp}" alt="${escapeHtml(m.userTag)}" style="width:52px;height:52px;border-radius:50%;border:2px solid ${pod.border};object-fit:cover" />
            <div style="overflow:hidden">
              <div style="font-weight:700;font-size:1rem;color:#fff;white-space:nowrap;text-overflow:ellipsis;overflow:hidden">
                ${escapeHtml(m.nickname || m.userTag)}${booster}
              </div>
              <div style="font-size:.75rem;color:var(--muted)">${escapeHtml(m.userTag)}</div>
              ${serverBadge}
            </div>
          </div>
          <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:6px;margin-top:auto">
            ${levelBadge}
            ${hitBadge}
          </div>
        </a>`;
      })
      .join('');
  }

  // Render Table Rows for all members
  const allMembersList = [...(aotw || []), ...(members || [])];
  let memberRows = '';

  if (allMembersList.length === 0) {
    memberRows = `<tr><td colspan="5" style="text-align:center;padding:30px;color:var(--muted)">No community members tracked for this scope yet.</td></tr>`;
  } else {
    memberRows = allMembersList
      .map((m) => {
        const pfp = m.avatar || `https://cdn.discordapp.com/embed/avatars/${parseInt(m.userId || '0') % 5}.png`;
        const booster = m.premium
          ? `<span title="Server Booster" style="color:#EC4899;margin-left:4px"><i class="fa-solid fa-gem"></i></span>`
          : '';
        const levelBadge = getLevelBadge(m.level);
        const hitBadge = getHitReqBadge(m.owosPastWeek);
        const serverInfo = !activeGuildId && m.serverCount && m.serverCount > 1
          ? `<span style="font-size:.72rem;color:var(--primary);margin-left:6px"><i class="fa-solid fa-earth-americas"></i> ${m.serverCount} servers</span>`
          : (m.guildName ? `<span style="font-size:.72rem;color:var(--primary);margin-left:6px"><i class="fa-solid fa-server"></i> ${escapeHtml(m.guildName)}</span>` : '');

        return `
        <tr>
          <td>
            <div style="display:flex;align-items:center;gap:10px">
              <img src="${pfp}" alt="${escapeHtml(m.userTag)}" style="width:36px;height:36px;border-radius:50%;border:1px solid var(--border);object-fit:cover" />
              <div>
                <div style="font-weight:600;color:#fff">${escapeHtml(m.nickname || m.userTag)}${booster}${serverInfo}</div>
                <div style="font-size:.75rem;color:var(--muted)">ID: ${m.userId}</div>
              </div>
            </div>
          </td>
          <td>${levelBadge}</td>
          <td>${hitBadge}</td>
          <td><strong style="color:#fff">${m.owosPastWeek || 0}</strong> <span style="font-size:.75rem;color:var(--muted)">owos</span></td>
          <td style="text-align:right">
            <a href="/members/${m.userId}${activeGuildId ? '?guildId=' + activeGuildId : ''}" class="btn btn-secondary btn-sm" style="padding:4px 10px;font-size:.75rem">
              View <i class="fa-solid fa-chevron-right" style="font-size:.7rem"></i>
            </a>
          </td>
        </tr>`;
      })
      .join('');
  }

  const content = membersTpl
    .replace(/\{\{WEEK_DATE\}\}/g, weekDateLabel)
    .replace(/\{\{SERVER_OPTIONS\}\}/g, serverOptions)
    .replace(/\{\{SCOPE_LABEL\}\}/g, scopeLabel)
    .replace(/\{\{TOTAL_MEMBERS\}\}/g, totalCount)
    .replace(/\{\{AOTW_CARDS\}\}/g, aotwCards)
    .replace(/\{\{MEMBER_ROWS\}\}/g, memberRows);

  return renderLayout(client, user, 'members', `Community Members — ${scopeLabel}`, content);
};

const pageMemberDetail = async (client, user, targetUserId, guildId = null) => {
  const activeGuildId = guildId && guildId !== 'all' ? guildId : null;
  const member = await atlantisService.getMember(targetUserId, activeGuildId);

  if (!member) {
    const errorHtml = `
      <div class="page" style="text-align:center;padding:60px 20px">
        <h1 style="font-size:2rem;margin-bottom:12px">Member Not Found</h1>
        <p style="color:var(--muted);margin-bottom:24px">No record exists in the database for user ID: <code>${escapeHtml(targetUserId)}</code>.</p>
        <a href="/members" class="btn btn-primary"><i class="fa-solid fa-arrow-left"></i> Return to Members List</a>
      </div>`;
    return renderLayout(client, user, 'members', 'Member Not Found', errorHtml);
  }

  const pfp = member.avatar || `https://cdn.discordapp.com/embed/avatars/${parseInt(member.userId || '0') % 5}.png`;
  const displayName = escapeHtml(member.nickname || member.userTag || `User ${member.userId}`);
  const userTag = escapeHtml(member.userTag || `ID: ${member.userId}`);
  const joinedDate = member.joinedServer ? new Date(member.joinedServer).toUTCString() : 'Unknown';
  const minTime = formatMinTime(member.owosPastWeek || 0);

  const boosterBadgeAbsolute = member.premium
    ? `<span style="position:absolute;bottom:0;right:0;background:#EC4899;color:#fff;width:26px;height:26px;border-radius:50%;display:flex;align-items:center;justify-content:center;box-shadow:0 0 10px rgba(236,72,153,0.5);font-size:.75rem" title="Server Booster"><i class="fa-solid fa-gem"></i></span>`
    : '';

  const boosterBadgeInline = member.premium
    ? `<span style="display:inline-flex;align-items:center;gap:4px;padding:3px 8px;border-radius:6px;font-size:.75rem;font-weight:600;background:rgba(236,72,153,0.18);color:#F472B6;border:1px solid rgba(236,72,153,0.35)"><i class="fa-solid fa-gem"></i> Server Booster</span>`
    : '';

  const roleBadge = getLevelBadge(member.level);
  const currentStatusBadge = getHitReqBadge(member.owosPastWeek);

  // Render Archive History Rows
  const archives = member.owosArchive || [];
  let archiveRows = '';

  if (archives.length === 0) {
    archiveRows = `<tr><td colspan="4" style="text-align:center;padding:30px;color:var(--muted)">No weekly archives recorded for this user yet.</td></tr>`;
  } else {
    archiveRows = [...archives]
      .reverse()
      .map((item) => {
        const hitBadge = getHitReqBadge(item.amountOfOwos, item.hitreq);
        const canExcuse = item.hitreq !== '✔️' && item.hitreq !== '⚠️' && (item.amountOfOwos || 0) < 50;

        const excuseBtn = canExcuse
          ? `<button class="btn btn-outline btn-sm" style="font-size:.75rem;padding:2px 10px;color:#FBBF24;border-color:rgba(245,158,11,0.4)" onclick="excuseWeek('${member.userId}', '${item.time}')"><i class="fa-solid fa-check"></i> Excuse</button>`
          : `<span style="color:var(--muted);font-size:.8rem">—</span>`;

        return `
        <tr>
          <td><strong style="color:#fff">${escapeHtml(item.weekOf || 'Past Week')}</strong></td>
          <td><strong style="color:var(--primary)">${item.amountOfOwos || 0}</strong> owos</td>
          <td>${hitBadge}</td>
          <td style="text-align:right">${excuseBtn}</td>
        </tr>`;
      })
      .join('');
  }

  const content = memberDetailTpl
    .replace(/\{\{AVATAR_URL\}\}/g, pfp)
    .replace(/\{\{DISPLAY_NAME\}\}/g, displayName)
    .replace(/\{\{USER_TAG\}\}/g, userTag)
    .replace(/\{\{USER_ID\}\}/g, member.userId)
    .replace(/\{\{JOINED_DATE\}\}/g, joinedDate)
    .replace(/\{\{OWO_COUNT\}\}/g, member.owosPastWeek || 0)
    .replace(/\{\{MIN_TIME\}\}/g, minTime)
    .replace(/\{\{ROLE_BADGE\}\}/g, roleBadge)
    .replace(/\{\{BOOSTER_BADGE_ABSOLUTE\}\}/g, boosterBadgeAbsolute)
    .replace(/\{\{BOOSTER_BADGE_INLINE\}\}/g, boosterBadgeInline)
    .replace(/\{\{CURRENT_STATUS_BADGE\}\}/g, currentStatusBadge)
    .replace(/\{\{ARCHIVE_ROWS\}\}/g, archiveRows);

  return renderLayout(client, user, 'members', `${displayName} — Community Profile`, content);
};

module.exports = {
  pageMembers,
  pageMemberDetail,
};
