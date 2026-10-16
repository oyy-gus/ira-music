'use strict';

const fs = require('fs');
const path = require('path');
const renderLayout = require('./layoutRenderer');

const htmlPath = path.join(__dirname, '../html/botstats.html');
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

const renderBotStats = async (client, user, getNodeStats) => {
  const memory = process.memoryUsage();
  const rssMb = Math.round(memory.rss / 1024 / 1024);
  const heapMb = Math.round(memory.heapUsed / 1024 / 1024);
  const heapTotalMb = Math.round(memory.heapTotal / 1024 / 1024);

  const players = client?.lavalink?.players?.size || 0;
  const upSec = Math.floor(process.uptime());

  const nodes = typeof getNodeStats === 'function' ? getNodeStats(client) : [];
  const onlineNodes = nodes.filter((n) => n.connected).length;

  let failoverSummary = null;
  try {
    const RecoveryMetrics = require('../../music/failover/RecoveryMetrics');
    if (RecoveryMetrics.getMetricsSummary) {
      failoverSummary = RecoveryMetrics.getMetricsSummary();
    }
  } catch (_) { /* optional metrics */ }

  const runtimeCards = [
    ['Uptime', fmtUptime(upSec)],
    ['Node.js', process.version],
    ['Platform', process.platform],
    ['Arch', process.arch],
  ].map(([lbl, val]) => `<div style="background:rgba(255,255,255,.04);border-radius:10px;padding:14px;text-align:center"><div style="font-family:var(--ff-title);font-size:1.1rem;font-weight:700;word-break:break-all">${val}</div><div style="font-size:.72rem;color:var(--muted);text-transform:uppercase;letter-spacing:.4px;margin-top:3px">${lbl}</div></div>`).join('');

  const clusterSummaryCards = [
    ['Total Nodes', nodes.length],
    ['Online', `<span style="color:var(--accent);font-weight:700">${onlineNodes}</span>`],
    ['Offline', `<span style="color:var(--red);font-weight:700">${nodes.length - onlineNodes}</span>`],
    ['Active Players', players],
    ['Total RAM Used', `${nodes.reduce((s,n)=>s+n.memory.usedMb,0)} MB`],
  ].map(([lbl, val]) => `<div style="background:rgba(255,255,255,.04);border-radius:10px;padding:14px;text-align:center"><div style="font-family:var(--ff-title);font-size:1.25rem;font-weight:700">${val}</div><div style="font-size:.72rem;color:var(--muted);text-transform:uppercase;letter-spacing:.4px;margin-top:3px">${lbl}</div></div>`).join('');

  const failoverSection = failoverSummary && Object.keys(failoverSummary).length > 0 ? `
    <div class="card">
      <h3 style="font-family:var(--ff-title);font-size:1.05rem;font-weight:700;margin-bottom:18px;display:flex;align-items:center;gap:8px"><i class="fa-solid fa-shield" style="color:var(--warn)"></i>Failover Metrics</h3>
      <pre style="font-size:.78rem;color:var(--muted);background:rgba(255,255,255,.03);padding:16px;border-radius:10px;overflow:auto;max-height:220px">${JSON.stringify(failoverSummary, null, 2)}</pre>
    </div>` : '';

  const body = tpl
    .replace(/\{\{RSS_MB\}\}/g, String(rssMb))
    .replace(/\{\{HEAP_MB\}\}/g, String(heapMb))
    .replace(/\{\{HEAP_TOTAL_MB\}\}/g, String(heapTotalMb))
    .replace(/\{\{RUNTIME_CARDS\}\}/g, runtimeCards)
    .replace(/\{\{CLUSTER_SUMMARY_CARDS\}\}/g, clusterSummaryCards)
    .replace(/\{\{FAILOVER_METRICS_SECTION\}\}/g, failoverSection);

  return renderLayout(client, user, 'botstats', 'Bot Stats', body);
};

module.exports = renderBotStats;
