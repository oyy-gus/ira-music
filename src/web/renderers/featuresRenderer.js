'use strict';

const fs = require('fs');
const path = require('path');
const renderLayout = require('./layoutRenderer');

const htmlPath = path.join(__dirname, '../html/features.html');
const tpl = fs.readFileSync(htmlPath, 'utf8');

const renderFeatures = (client, user) => {
  const botName = client?.user?.username || 'IRA Music';
  const features = [
    { icon: 'fa-bolt', color: 'spi-blue', title: 'Multi-Node Failover', desc: 'Instant zero-downtime queue migration across Lavalink nodes when any node experiences latency spikes or disconnects. Your music never stops.' },
    { icon: 'fa-palette', color: 'spi-pink', title: 'Canvas Profiles & Cosmetics', desc: 'Unlock profile frames, backgrounds, glows, name effects, and visualizers as you listen to music and level up your listening rank.' },
    { icon: 'fa-chart-line', color: 'spi-green', title: 'Detailed Music Analytics', desc: 'Track your top played tracks, favorite artists, most listened servers, and top companions with dynamic stats cards generated on canvas.' },
    { icon: 'fa-sliders', color: 'spi-yellow', title: 'Audio Filters & EQ', desc: 'Fine-tune your experience with equalizers, nightcore, bassboost, karaoke, 8D audio, tremolo, vibrato, and more advanced DSP filters.' },
    { icon: 'fa-trophy', color: 'spi-blue', title: 'XP & Progression', desc: 'Earn XP for every song you listen to. Level up to unlock new cosmetics, exclusive titles, and badges that show off your listening habits.' },
    { icon: 'fa-shield-halved', color: 'spi-red', title: 'Security & Rate Limiting', desc: 'Built-in command rate limiting, audit logging, and security event tracking to keep your server safe from abuse and spam.' },
    { icon: 'fa-music', color: 'spi-green', title: 'Multi-Source Playback', desc: 'Search and stream from YouTube and SoundCloud with high-quality audio. Supports links, search queries, playlists, and live streams.' },
    { icon: 'fa-list', color: 'spi-pink', title: 'Queue Management', desc: 'Full-featured queue with shuffle, loop, skip, remove, move, and autoplay recommendations powered by related track detection.' },
  ];

  const cards = features.map((f) => `
    <div class="feat-card">
      <div class="feat-icon ${f.color}"><i class="fa-solid ${f.icon}"></i></div>
      <h3 style="font-family:var(--ff-title);font-size:1.1rem;font-weight:700;margin-bottom:10px">${f.title}</h3>
      <p style="color:var(--muted);font-size:.88rem;line-height:1.55">${f.desc}</p>
    </div>
  `).join('');

  const body = tpl
    .replace(/\{\{BOT_NAME\}\}/g, botName)
    .replace(/\{\{FEATURE_CARDS\}\}/g, cards);

  return renderLayout(client, user, 'features', 'Features', body);
};

module.exports = renderFeatures;
