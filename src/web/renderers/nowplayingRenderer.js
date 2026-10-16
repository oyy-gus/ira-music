'use strict';

const fs = require('fs');
const path = require('path');
const renderLayout = require('./layoutRenderer');

const htmlPath = path.join(__dirname, '../html/nowplaying.html');
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

const fmtDuration = (ms) => {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  if (h > 0) return `${h}:${String(m % 60).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
  return `${m}:${String(s % 60).padStart(2, '0')}`;
};

const renderNowPlaying = (client, user, getNowPlayingList) => {
  const list = typeof getNowPlayingList === 'function' ? getNowPlayingList(client) : [];
  const activeStreamingCount = list.filter((n) => n.playing).length;

  const cards = list.length === 0
    ? `<div class="empty" style="grid-column:1/-1"><i class="fa-solid fa-headphones-simple"></i><p>Bot is not currently in any voice channels.<br><span style="font-size:.8rem">Invite the bot to a server and join a voice channel to see live status here!</span></p></div>`
    : list.map((np) => {
        const guildNameEsc = escapeHtml(np.guildName);
        const channelNameEsc = escapeHtml(np.channelName);
        const trackTitleEsc = escapeHtml(np.track?.title || 'Unknown Title');
        const trackAuthorEsc = escapeHtml(np.track?.author || 'Unknown Artist');

        const membersHtml = np.membersInVc.length === 0
          ? `<span style="font-size:.78rem;color:var(--muted);font-style:italic">No users in this voice channel</span>`
          : np.membersInVc.map((m) => {
              const mNameEsc = escapeHtml(m.name);
              const mUserEsc = escapeHtml(m.username ? '@' + m.username : 'ID: ' + m.id);
              return `
              <div class="vc-user-pill" title="${mNameEsc} (${mUserEsc})">
                <img src="${m.avatar}" alt="" onerror="this.src='https://cdn.discordapp.com/embed/avatars/0.png'" />
                <span class="vc-user-name">${mNameEsc}</span>
                ${m.isMuted ? '<i class="fa-solid fa-microphone-slash" style="color:var(--red);font-size:.68rem" title="Muted"></i>' : ''}
                ${m.isDeafened ? '<i class="fa-solid fa-volume-xmark" style="color:var(--warn);font-size:.68rem" title="Deafened"></i>' : ''}
              </div>
            `;
            }).join('');

        let statusChip = '<span class="chip chip-blue"><i class="fa-solid fa-microphone"></i> In VC (Idle)</span>';
        if (np.playing) {
          statusChip = '<span class="chip chip-green"><i class="fa-solid fa-play"></i> Live Playing</span>';
        } else if (np.paused) {
          statusChip = '<span class="chip chip-yellow"><i class="fa-solid fa-pause"></i> Paused</span>';
        }

        return `
        <div class="np-card">
          ${np.track?.thumbnail
            ? `<img class="np-thumb" src="${np.track.thumbnail}" alt="" onerror="this.style.display='none'" />`
            : `<div class="np-thumb-placeholder"><i class="fa-solid fa-microphone-lines" style="color:var(--primary)"></i></div>`}
          <div class="np-body">
            <div class="np-guild">
              ${np.guildIcon ? `<img class="np-guild-icon" src="${np.guildIcon}" alt="" />` : '<div class="np-guild-icon" style="background:rgba(88,101,242,.15);display:flex;align-items:center;justify-content:center"><i class="fa-brands fa-discord" style="font-size:.65rem;color:var(--primary)"></i></div>'}
              <span class="np-guild-name">${guildNameEsc}</span>
              ${statusChip}
            </div>

            ${np.track ? `
              <div class="np-title">${trackTitleEsc}</div>
              <div class="np-author">${trackAuthorEsc}</div>
              <div class="np-meta">
                <span class="chip chip-blue"><i class="fa-solid fa-clock"></i>${fmtDuration(np.track.duration)}</span>
                <span class="chip chip-blue"><i class="fa-solid fa-list"></i>+${np.queueLength} queued</span>
                <span class="chip chip-blue"><i class="fa-solid fa-volume-high"></i>${np.volume}%</span>
                <span class="chip" style="background:rgba(255,255,255,.06);color:var(--muted)"><i class="fa-solid fa-bullhorn"></i> #${channelNameEsc}</span>
              </div>
            ` : `
              <div class="np-title" style="color:var(--muted);font-size:.95rem">No track currently playing</div>
              <div class="np-meta" style="margin-top:4px">
                <span class="chip" style="background:rgba(255,255,255,.06);color:var(--muted)"><i class="fa-solid fa-bullhorn"></i> #${channelNameEsc}</span>
              </div>
            `}

            <div style="margin-top:14px;padding-top:12px;border-top:1px solid var(--border)">
              <div style="font-size:.75rem;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.5px;margin-bottom:8px;display:flex;align-items:center;gap:6px">
                <i class="fa-solid fa-users" style="color:var(--primary)"></i> In Voice Channel (${np.membersInVc.length})
              </div>
              <div style="display:flex;flex-wrap:wrap;gap:6px">${membersHtml}</div>
            </div>

          </div>
        </div>
      `;
      }).join('');

  const streamingBadge = list.length > 0 ? `<div class="chip chip-green" style="font-size:.85rem;padding:8px 16px"><span class="pulse" style="display:inline-block"></span>&nbsp;${list.length} active VC${list.length > 1 ? 's' : ''} (${activeStreamingCount} playing)</div>` : '';

  const body = tpl
    .replace(/\{\{STREAMING_BADGE\}\}/g, streamingBadge)
    .replace(/\{\{NP_CARDS\}\}/g, cards);

  return renderLayout(client, user, 'nowplaying', 'Now Playing', body);
};

module.exports = renderNowPlaying;
