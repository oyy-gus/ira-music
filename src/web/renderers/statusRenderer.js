'use strict';

const fs = require('fs');
const path = require('path');
const renderLayout = require('./layoutRenderer');

const htmlPath = path.join(__dirname, '../html/status.html');
const tpl = fs.readFileSync(htmlPath, 'utf8');

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

const renderStatus = (client, user, getNodeStats) => {
  const nodes = typeof getNodeStats === 'function' ? getNodeStats(client) : [];
  const onlineCount = nodes.filter((n) => n.connected).length;

  const cards = nodes.map((n) => {
    const memPct = Math.min(100, n.memory.allocatedMb > 0 ? Math.round((n.memory.usedMb / n.memory.allocatedMb) * 100) : 0);
    const cpuPct = Math.min(100, n.cpu.lavalinkLoad);
    const upSec = Math.floor((n.uptimeMs || 0) / 1000);
    return `
    <div class="node-card">
      <div class="node-head">
        <span class="node-id">${n.id}</span>
        <span class="chip ${n.connected ? 'chip-green' : 'chip-red'}"><span class="dot"></span>${n.connected ? 'ONLINE' : 'OFFLINE'}</span>
      </div>

      <div class="node-metric">
        <div class="node-metric-lbl"><span>Memory Usage</span><strong>${n.memory.usedMb} / ${n.memory.allocatedMb} MB</strong></div>
        <div class="progress"><div class="progress-fill" style="width:${memPct}%"></div></div>
      </div>
      <div class="node-metric">
        <div class="node-metric-lbl"><span>CPU Load</span><strong>${cpuPct}%</strong></div>
        <div class="progress"><div class="progress-fill" style="width:${cpuPct}%"></div></div>
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:14px">
        <div style="background:rgba(255,255,255,.04);border-radius:10px;padding:12px;text-align:center">
          <div style="font-family:var(--ff-title);font-size:1.3rem;font-weight:700">${n.playersCount}</div>
          <div style="font-size:.72rem;color:var(--muted);text-transform:uppercase;letter-spacing:.4px">Players</div>
        </div>
        <div style="background:rgba(255,255,255,.04);border-radius:10px;padding:12px;text-align:center">
          <div style="font-family:var(--ff-title);font-size:1.3rem;font-weight:700">${n.pingMs}ms</div>
          <div style="font-size:.72rem;color:var(--muted);text-transform:uppercase;letter-spacing:.4px">Latency</div>
        </div>
        <div style="background:rgba(255,255,255,.04);border-radius:10px;padding:12px;text-align:center">
          <div style="font-family:var(--ff-title);font-size:1.3rem;font-weight:700">${fmtUptime(upSec)}</div>
          <div style="font-size:.72rem;color:var(--muted);text-transform:uppercase;letter-spacing:.4px">Uptime</div>
        </div>
        <div style="background:rgba(255,255,255,.04);border-radius:10px;padding:12px;text-align:center">
          <div style="font-family:var(--ff-title);font-size:1.3rem;font-weight:700">${n.memory.freeMb}MB</div>
          <div style="font-size:.72rem;color:var(--muted);text-transform:uppercase;letter-spacing:.4px">Free RAM</div>
        </div>
      </div>
    </div>`;
  }).join('');

  const clusterChipClass = onlineCount === nodes.length ? 'chip-green' : onlineCount > 0 ? 'chip-yellow' : 'chip-red';

  const body = tpl
    .replace(/\{\{TOTAL_NODES\}\}/g, String(nodes.length))
    .replace(/\{\{ONLINE_NODES\}\}/g, String(onlineCount))
    .replace(/\{\{CLUSTER_STATUS_CHIP_CLASS\}\}/g, clusterChipClass)
    .replace(/\{\{NODE_CARDS\}\}/g, nodes.length === 0 ? '<div class="empty"><i class="fa-solid fa-server"></i><p>No Lavalink nodes configured.</p></div>' : cards);

  return renderLayout(client, user, 'status', 'Node Cluster', body);
};

module.exports = renderStatus;
