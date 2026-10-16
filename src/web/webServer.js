'use strict';

const http = require('http');
const https = require('https');
const urlModule = require('url');
const querystring = require('querystring');
const path = require('path');
const fs = require('fs');
const mongoose = require('mongoose');

const config = require('../config');
const logger = require('../logger/logger');
const RecoveryMetrics = require('../music/failover/RecoveryMetrics');
const { NodeHealthMonitor } = require('../music/failover/NodeHealthMonitor');
const greetingService = require('../services/greetingService');
const uploadService = require('../services/uploadService');
const atlantisService = require('../services/atlantis/atlantisService');

// Import modularized view components
const {
  pageHome,
  pageFeatures,
  pageCommands,
  pageLeaderboard,
  pageNowPlaying,
  pageStatus,
  pageBotStats,
  pageTerms,
  pagePrivacy,
  pageServers,
  pageServerSettings,
  pageMembers,
  pageMemberDetail,
} = require('./renderers');

// ─── Security & Hardening ───────────────────────────────────────────────────
const setSecurityHeaders = (res) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
};

const ipRateLimitMap = new Map();
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
const MAX_REQUESTS_PER_WINDOW = 120;

const checkRateLimit = (req, res) => {
  const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket?.remoteAddress || '127.0.0.1';
  const now = Date.now();
  let record = ipRateLimitMap.get(ip);

  if (!record || now - record.startTime > RATE_LIMIT_WINDOW_MS) {
    record = { count: 1, startTime: now };
    ipRateLimitMap.set(ip, record);
    return false;
  }

  record.count += 1;
  if (record.count > MAX_REQUESTS_PER_WINDOW) {
    setSecurityHeaders(res);
    res.writeHead(429, { 'Content-Type': 'text/plain; charset=utf-8', 'Retry-After': '60' });
    res.end('429 Too Many Requests — Rate limit exceeded. Please try again in 1 minute.');
    return true;
  }

  return false;
};

setInterval(() => {
  const now = Date.now();
  for (const [ip, record] of ipRateLimitMap.entries()) {
    if (now - record.startTime > RATE_LIMIT_WINDOW_MS) ipRateLimitMap.delete(ip);
  }
}, 5 * 60 * 1000);

// ─── Cookie / Session Helpers ────────────────────────────────────────────────
const parseCookies = (req) => {
  const list = {};
  const rc = req.headers.cookie;
  if (rc) rc.split(';').forEach((c) => { const p = c.split('='); list[p.shift().trim()] = decodeURIComponent(p.join('=')); });
  return list;
};

const getLoggedInUser = (req) => {
  try {
    const c = parseCookies(req);
    if (c.session_user) return JSON.parse(c.session_user);
  } catch (_) { /* ignore */ }
  return null;
};

// ─── Data Helpers ─────────────────────────────────────────────────────────────
const getPublicCommands = (client) => {
  if (!client?.commands) return [];
  const list = [];
  client.commands.forEach((cmd) => {
    if (cmd.category === 'developer' || cmd.ownerOnly === true) return;
    list.push({ name: cmd.name, description: cmd.description || 'No description.', aliases: cmd.aliases || [], category: cmd.category || 'utility', cooldown: cmd.cooldown || 0 });
  });
  return list.sort((a, b) => a.name.localeCompare(b.name));
};

const getNodeStats = (client) => {
  const nodeStatsMap = NodeHealthMonitor.getAllNodeStats() || [];
  const lavalinkNodes = client?.lavalink?.nodeManager?.nodes || new Map();
  return (config.lavalink?.nodes || []).map((cfgNode) => {
    const liveNode = Array.from(lavalinkNodes.values()).find((n) => n.id === cfgNode.id || n.options?.host === cfgNode.host);
    const healthStat = nodeStatsMap.find((s) => s.nodeId === cfgNode.id);
    const stats = liveNode?.stats || {};
    return {
      id: cfgNode.id,
      connected: liveNode ? liveNode.connected : false,
      playersCount: liveNode?.players?.size || stats.players || 0,
      playingPlayersCount: stats.playingPlayers || 0,
      uptimeMs: stats.uptime || 0,
      memory: { usedMb: Math.round((stats.memory?.used || 0) / 1024 / 1024), freeMb: Math.round((stats.memory?.free || 0) / 1024 / 1024), allocatedMb: Math.round((stats.memory?.allocated || 0) / 1024 / 1024) },
      cpu: { systemLoad: Math.round((stats.cpu?.systemLoad || 0) * 100), lavalinkLoad: Math.round((stats.cpu?.lavalinkLoad || 0) * 100) },
      pingMs: liveNode?.ping || healthStat?.latencyMs || 0,
    };
  });
};

const getNowPlayingList = (client) => {
  const result = [];
  if (!client?.guilds?.cache) return result;

  const processedGuilds = new Set();
  const botId = client?.user?.id;

  for (const [guildId, player] of (client?.lavalink?.players || new Map())) {
    const guild = client.guilds.cache.get(guildId);
    if (!guild) continue;
    processedGuilds.add(guildId);

    const me = guild.members.me || guild.members.cache.get(botId);
    const vcId = player.voiceId || me?.voice?.channelId;
    const vc = vcId ? guild.channels.cache.get(vcId) : null;

    const membersInVc = vc?.members
      ? Array.from(vc.members.values())
          .filter((m) => m.id !== botId)
          .map((m) => ({
            id: m.id,
            name: m.displayName || m.user?.username || 'User',
            username: m.user?.username || '',
            avatar: m.user?.displayAvatarURL
              ? m.user.displayAvatarURL({ extension: 'png', size: 64 })
              : `https://cdn.discordapp.com/embed/avatars/${parseInt(m.id || '0') % 6}.png`,
            isBot: !!m.user?.bot,
            isMuted: !!(m.voice?.selfMute || m.voice?.serverMute),
            isDeafened: !!(m.voice?.selfDeaf || m.voice?.serverDeaf),
          }))
      : [];

    const currentTrack = player.queue?.current;

    result.push({
      guildId,
      guildName: guild.name,
      guildIcon: guild.iconURL({ extension: 'png', size: 64 }) || null,
      channelId: vc?.id || null,
      channelName: vc?.name || 'Voice Channel',
      memberCount: guild.memberCount || 0,
      playing: !!(player.playing && currentTrack),
      paused: !!player.paused,
      track: currentTrack
        ? {
            title: currentTrack.info?.title || 'Unknown',
            author: currentTrack.info?.author || 'Unknown',
            duration: currentTrack.info?.duration || 0,
            uri: currentTrack.info?.uri || '',
            thumbnail: currentTrack.info?.artworkUrl || currentTrack.info?.thumbnail || null,
            sourceName: currentTrack.info?.sourceName || 'unknown',
          }
        : null,
      queueLength: player.queue?.tracks?.length || 0,
      volume: player.volume || 100,
      membersInVc,
    });
  }

  for (const [guildId, guild] of client.guilds.cache) {
    if (processedGuilds.has(guildId)) continue;
    const me = guild.members.me || guild.members.cache.get(botId);
    const vc = me?.voice?.channel;
    if (vc) {
      processedGuilds.add(guildId);
      const membersInVc = Array.from(vc.members.values())
        .filter((m) => m.id !== botId)
        .map((m) => ({
          id: m.id,
          name: m.displayName || m.user?.username || 'User',
          username: m.user?.username || '',
          avatar: m.user?.displayAvatarURL
            ? m.user.displayAvatarURL({ extension: 'png', size: 64 })
            : `https://cdn.discordapp.com/embed/avatars/${parseInt(m.id || '0') % 6}.png`,
          isBot: !!m.user?.bot,
          isMuted: !!(m.voice?.selfMute || m.voice?.serverMute),
          isDeafened: !!(m.voice?.selfDeaf || m.voice?.serverDeaf),
        }));

      result.push({
        guildId,
        guildName: guild.name,
        guildIcon: guild.iconURL({ extension: 'png', size: 64 }) || null,
        channelId: vc.id,
        channelName: vc.name,
        memberCount: guild.memberCount || 0,
        playing: false,
        paused: false,
        track: null,
        queueLength: 0,
        volume: 100,
        membersInVc,
      });
    }
  }

  return result;
};

// ─── MAIN WEB SERVER ────────────────────────────────────────────────────────
const startWebServer = (client, port = 3000) => {
  if (config.web?.enabled === false) {
    logger.info('[WebServer] Web server disabled (web.enabled = false). Set WEB_ENABLED=true to enable.');
    return null;
  }

  const serverPort = config.web?.port || port;

  const server = http.createServer(async (req, res) => {
    setSecurityHeaders(res);

    if (checkRateLimit(req, res)) return;

    if (req.url && req.url.length > 2048) {
      res.writeHead(414, { 'Content-Type': 'text/plain; charset=utf-8' });
      return res.end('414 URI Too Long');
    }

    if (req.method !== 'GET' && req.method !== 'HEAD' && req.method !== 'POST' && req.method !== 'PUT') {
      res.writeHead(405, { 'Content-Type': 'text/plain; charset=utf-8' });
      return res.end('405 Method Not Allowed');
    }

    const parsedUrl = urlModule.parse(req.url, true);
    const pathname = parsedUrl.pathname;
    const user = getLoggedInUser(req);

    // ── Static Asset Serving (/css/*, /js/*) ──────────────────────────────────
    if (pathname.startsWith('/css/') || pathname.startsWith('/js/')) {
      const safePath = path.normalize(pathname).replace(/^(\.\.[\/\\])+/, '');
      const filePath = path.join(__dirname, 'public', safePath);

      if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
        const ext = path.extname(filePath);
        const mimeTypes = {
          '.css': 'text/css; charset=utf-8',
          '.js': 'application/javascript; charset=utf-8',
          '.png': 'image/png',
          '.jpg': 'image/jpeg',
          '.svg': 'image/svg+xml'
        };
        res.writeHead(200, {
          'Content-Type': mimeTypes[ext] || 'application/octet-stream',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0',
        });
        return fs.createReadStream(filePath).pipe(res);
      }
    }

    // ── Auth Routes ──────────────────────────────────────────────────────────
    if (pathname === '/auth/discord/login') {
      const clientId = config.discord?.clientId;
      const redirectUri = config.web?.redirectUri || `http://localhost:${serverPort}/auth/discord/callback`;
      const url = `https://discord.com/oauth2/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=identify`;
      res.writeHead(302, { Location: url });
      return res.end();
    }

    if (pathname === '/auth/discord/callback') {
      const code = parsedUrl.query.code;
      const clientId = config.discord?.clientId;
      const clientSecret = config.web?.clientSecret;
      const redirectUri = config.web?.redirectUri || `http://localhost:${serverPort}/auth/discord/callback`;

      if (code && clientSecret) {
        try {
          const postData = querystring.stringify({ client_id: clientId, client_secret: clientSecret, grant_type: 'authorization_code', code, redirect_uri: redirectUri });
          const tokenRes = await new Promise((resolve, reject) => {
            const tokenReq = https.request('https://discord.com/api/oauth2/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': Buffer.byteLength(postData) } }, (r) => {
              let body = ''; r.on('data', c => body += c); r.on('end', () => resolve(JSON.parse(body)));
            });
            tokenReq.on('error', reject); tokenReq.write(postData); tokenReq.end();
          });

          if (tokenRes.access_token) {
            const userRes = await new Promise((resolve, reject) => {
              https.get('https://discord.com/api/users/@me', { headers: { Authorization: `Bearer ${tokenRes.access_token}` } }, (r) => {
                let body = ''; r.on('data', c => body += c); r.on('end', () => resolve(JSON.parse(body)));
              }).on('error', reject);
            });
            if (userRes.id) {
              const userData = { id: userRes.id, username: userRes.username, global_name: userRes.global_name || userRes.username, avatar: userRes.avatar, avatar_url: userRes.avatar ? `https://cdn.discordapp.com/avatars/${userRes.id}/${userRes.avatar}.png` : 'https://cdn.discordapp.com/embed/avatars/0.png' };
              res.writeHead(302, { 'Set-Cookie': `session_user=${encodeURIComponent(JSON.stringify(userData))}; Path=/; HttpOnly; SameSite=Lax; Max-Age=604800`, Location: '/' });
              return res.end();
            }
          }
        } catch (err) { logger.error('[WebServer] OAuth2 error:', err); }
      }
      res.writeHead(302, { Location: '/' }); return res.end();
    }

    if (pathname === '/auth/discord/logout') {
      res.writeHead(302, { 'Set-Cookie': 'session_user=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0', Location: '/' });
      return res.end();
    }

    // ── JSON API ─────────────────────────────────────────────────────────────
    if (pathname === '/api/commands') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ status: 'OK', commands: getPublicCommands(client) }));
    }
    if (pathname === '/api/nodes') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ status: 'OK', nodes: getNodeStats(client) }));
    }
    if (pathname === '/api/nowplaying') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ status: 'OK', streams: getNowPlayingList(client) }));
    }
    if (pathname === '/api/stats') {
      const memory = process.memoryUsage();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ status: 'OK', stats: { guilds: client?.guilds?.cache?.size || 0, players: client?.lavalink?.players?.size || 0, uptimeSeconds: Math.floor(process.uptime()), memory: { rssMb: Math.round(memory.rss / 1024 / 1024), heapUsedMb: Math.round(memory.heapUsed / 1024 / 1024) } } }));
    }

    // ── Community Members API ────────────────────────────────────────────────
    if (pathname === '/api/members' && req.method === 'GET') {
      const guildId = parsedUrl.query?.guildId || null;
      const data = await atlantisService.getMembersLeaderboard(guildId);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ status: 'OK', ...data }));
    }

    if (pathname === '/api/members/week-reset' && req.method === 'POST') {
      const guildId = parsedUrl.query?.guildId || null;
      let bodyStr = '';
      req.on('data', (chunk) => (bodyStr += chunk));
      return req.on('end', async () => {
        try {
          const body = JSON.parse(bodyStr || '{}');
          const targetGuildId = body.guildId || guildId;
          const result = await atlantisService.weekReset(targetGuildId);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify(result));
        } catch (e) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ status: 'ERROR', message: e.message }));
        }
      });
    }

    const excuseApiMatch = pathname.match(/^\/api\/members\/(\d+)\/excuse$/);
    if (excuseApiMatch && req.method === 'POST') {
      const targetUserId = excuseApiMatch[1];
      const guildId = parsedUrl.query?.guildId || null;
      let bodyStr = '';
      req.on('data', (chunk) => (bodyStr += chunk));
      return req.on('end', async () => {
        try {
          const body = JSON.parse(bodyStr || '{}');
          await atlantisService.excuseMemberWeek(targetUserId, body.time, body.guildId || guildId);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ status: 'OK' }));
        } catch (e) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ status: 'ERROR', message: e.message }));
        }
      });
    }

    const memberDeleteApiMatch = pathname.match(/^\/api\/members\/(\d+)$/);
    if (memberDeleteApiMatch && req.method === 'DELETE') {
      const targetUserId = memberDeleteApiMatch[1];
      const guildId = parsedUrl.query?.guildId || null;
      await atlantisService.deleteMember(targetUserId, guildId);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ status: 'OK' }));
    }

    // ── Legacy Atlantis Route Handlers ───────────────────────────────────────
    if (pathname === '/weekReset') {
      const guildId = parsedUrl.query?.guildId || null;
      await atlantisService.weekReset(guildId).catch(() => {});
      res.writeHead(302, { Location: guildId ? `/members?guildId=${encodeURIComponent(guildId)}` : '/members' });
      return res.end();
    }

    const legacyExcuseMatch = pathname.match(/^\/excuse\/(\d+)\/(\d+)$/);
    if (legacyExcuseMatch) {
      const targetUserId = legacyExcuseMatch[1];
      const time = legacyExcuseMatch[2];
      const guildId = parsedUrl.query?.guildId || null;
      await atlantisService.excuseMemberWeek(targetUserId, time, guildId).catch(() => {});
      res.writeHead(302, { Location: `/members/${targetUserId}${guildId ? `?guildId=${encodeURIComponent(guildId)}` : ''}` });
      return res.end();
    }

    const legacyDeleteMatch = pathname.match(/^\/delete\/(\d+)$/);
    if (legacyDeleteMatch) {
      const targetUserId = legacyDeleteMatch[1];
      const guildId = parsedUrl.query?.guildId || null;
      await atlantisService.deleteMember(targetUserId, guildId).catch(() => {});
      res.writeHead(302, { Location: guildId ? `/members?guildId=${encodeURIComponent(guildId)}` : '/members' });
      return res.end();
    }

    // ── Greeting & Server Settings API ──────────────────────────────────────
    const greetingApiMatch = pathname.match(/^\/api\/guilds\/(\d+)\/greeting(\/(preview|reset|reset-appearance|upload-background))?$/);
    if (greetingApiMatch) {
      const guildId = greetingApiMatch[1];
      const action = greetingApiMatch[3] || '';

      // Validate access
      const access = (() => {
        if (!guildId || !/^\d+$/.test(guildId)) return { ok: false, status: 400, message: 'Invalid Guild ID' };
        const g = client?.guilds?.cache?.get(guildId);
        if (!g) return { ok: false, status: 404, message: 'Ira Music is not installed in this server' };
        if (!user || !user.id) return { ok: false, status: 401, message: 'Discord login required' };
        const member = g.members.cache.get(user.id);
        const isOwner = g.ownerId === user.id;
        const hasPerm = member?.permissions?.has('ManageGuild') || member?.permissions?.has('Administrator');
        if (!isOwner && !hasPerm) return { ok: false, status: 403, message: 'Manage Server permission required' };
        return { ok: true, guild: g };
      })();

      if (!access.ok) {
        res.writeHead(access.status, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ status: 'ERROR', message: access.message }));
      }

      if (req.method === 'GET' && !action) {
        const configData = (await greetingService.getGreetingConfig(guildId)) || {};
        const me = access.guild.members.me;
        const channels = Array.from(access.guild.channels.cache.values())
          .filter(c => c.isTextBased() && !c.isThread())
          .map(c => {
            const perms = me ? c.permissionsFor(me) : null;
            const missing = [];
            if (!perms?.has('ViewChannel')) missing.push('View Channel');
            if (!perms?.has('SendMessages')) missing.push('Send Messages');
            if (!perms?.has('AttachFiles')) missing.push('Attach Files');
            if (!perms?.has('EmbedLinks')) missing.push('Embed Links');
            return {
              id: c.id,
              name: c.name,
              canSend: missing.length === 0,
              missingPermissions: missing,
            };
          });

        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ status: 'OK', config: configData, channels }));
      }

      if (req.method === 'PUT' && !action) {
        let bodyStr = '';
        req.on('data', chunk => bodyStr += chunk);
        return req.on('end', async () => {
          try {
            const body = JSON.parse(bodyStr);
            const type = body.type || 'welcome';
            const updated = await greetingService.updateGreetingConfig(guildId, type, body.config || {});
            res.writeHead(200, { 'Content-Type': 'application/json' });
            return res.end(JSON.stringify({ status: 'OK', config: updated }));
          } catch (e) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            return res.end(JSON.stringify({ status: 'ERROR', message: e.message }));
          }
        });
      }

      if (req.method === 'POST' && action === 'preview') {
        let bodyStr = '';
        req.on('data', chunk => bodyStr += chunk);
        return req.on('end', async () => {
          try {
            const body = JSON.parse(bodyStr);
            const userDisp = user ? (user.global_name || user.username) : (client?.user?.username || 'Ira Music');
            const userUnm = user?.username || client?.user?.username || 'iramusic';
            const userAvt = user?.avatar_url || null;
            const dataUrl = await greetingService.renderPreview({
              ...body,
              displayName: userDisp,
              username: userUnm,
              avatarUrl: userAvt,
            });
            res.writeHead(200, { 'Content-Type': 'application/json' });
            return res.end(JSON.stringify({ status: 'OK', dataUrl }));
          } catch (e) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            return res.end(JSON.stringify({ status: 'ERROR', message: e.message }));
          }
        });
      }

      if (req.method === 'POST' && action === 'reset') {
        let bodyStr = '';
        req.on('data', chunk => bodyStr += chunk);
        return req.on('end', async () => {
          try {
            const body = JSON.parse(bodyStr);
            const type = body.type || 'welcome';
            const updated = await greetingService.resetGreetingConfig(guildId, type);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            return res.end(JSON.stringify({ status: 'OK', config: updated }));
          } catch (e) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            return res.end(JSON.stringify({ status: 'ERROR', message: e.message }));
          }
        });
      }

      if (req.method === 'POST' && action === 'reset-appearance') {
        let bodyStr = '';
        req.on('data', chunk => bodyStr += chunk);
        return req.on('end', async () => {
          try {
            const body = JSON.parse(bodyStr);
            const type = body.type || 'welcome';
            const updated = await greetingService.resetAppearance(guildId, type);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            return res.end(JSON.stringify({ status: 'OK', config: updated }));
          } catch (e) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            return res.end(JSON.stringify({ status: 'ERROR', message: e.message }));
          }
        });
      }

      if (req.method === 'POST' && action === 'upload-background') {
        let bodyStr = '';
        req.on('data', chunk => bodyStr += chunk);
        return req.on('end', async () => {
          try {
            const body = JSON.parse(bodyStr);
            const base64Data = (body.data || '').replace(/^data:image\/\w+;base64,/, '');
            const buffer = Buffer.from(base64Data, 'base64');
            const url = await uploadService.processBackgroundUpload(guildId, buffer, body.mime, body.filename || 'bg.png');
            res.writeHead(200, { 'Content-Type': 'application/json' });
            return res.end(JSON.stringify({ status: 'OK', url }));
          } catch (e) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            return res.end(JSON.stringify({ status: 'ERROR', message: e.message }));
          }
        });
      }
    }

    // ── Health Endpoints ──────────────────────────────────────────────────────
    if (pathname === '/health' || pathname === '/liveness') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ status: 'UP', timestamp: new Date().toISOString() }));
    }
    if (pathname === '/ready') {
      const dbOk = mongoose.connection.readyState === 1;
      const discordOk = client?.isReady ? client.isReady() : false;
      const ok = dbOk && discordOk;
      res.writeHead(ok ? 200 : 503, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ status: ok ? 'READY' : 'NOT_READY', checks: { discord: discordOk, mongodb: dbOk } }));
    }
    if (pathname === '/metrics') {
      const mem = process.memoryUsage();
      const g = client?.guilds?.cache?.size || 0;
      const p = client?.lavalink?.players?.size || 0;
      const base = `# HELP bot_guilds_total Total guilds\n# TYPE bot_guilds_total gauge\nbot_guilds_total ${g}\n# HELP bot_active_players Total active players\n# TYPE bot_active_players gauge\nbot_active_players ${p}\n# HELP process_rss_bytes RSS memory\n# TYPE process_rss_bytes gauge\nprocess_rss_bytes ${mem.rss}`;
      res.writeHead(200, { 'Content-Type': 'text/plain; version=0.0.4' });
      return res.end(`${base}\n\n${RecoveryMetrics.toPrometheusString ? RecoveryMetrics.toPrometheusString() : ''}`);
    }

    // ── HTML Page Router ──────────────────────────────────────────────────────
    const sendHtml = (html) => { res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }); res.end(html); };

    try {
      if (pathname === '/' || pathname === '/index.html') return sendHtml(pageHome(client, user, getNowPlayingList));
      if (pathname === '/features') return sendHtml(pageFeatures(client, user));
      if (pathname === '/commands') return sendHtml(pageCommands(client, user));
      if (pathname === '/leaderboard') return sendHtml(await pageLeaderboard(client, user));
      if (pathname === '/members') {
        const guildId = parsedUrl.query?.guildId || null;
        return sendHtml(await pageMembers(client, user, guildId));
      }

      const memberDetailMatch = pathname.match(/^\/members\/(\d+)$/);
      if (memberDetailMatch) {
        const guildId = parsedUrl.query?.guildId || null;
        return sendHtml(await pageMemberDetail(client, user, memberDetailMatch[1], guildId));
      }
      const legacyMemberDetailMatch = pathname.match(/^\/member\/(\d+)$/);
      if (legacyMemberDetailMatch) {
        const guildId = parsedUrl.query?.guildId || null;
        return sendHtml(await pageMemberDetail(client, user, legacyMemberDetailMatch[1], guildId));
      }

      if (pathname === '/nowplaying') return sendHtml(pageNowPlaying(client, user, getNowPlayingList));
      if (pathname === '/status') return sendHtml(pageStatus(client, user, getNodeStats));
      if (pathname === '/botstats') return sendHtml(await pageBotStats(client, user, getNodeStats));
      if (pathname === '/terms') return sendHtml(pageTerms(client, user));
      if (pathname === '/privacy') return sendHtml(pagePrivacy(client, user));

      if (pathname === '/servers') return sendHtml(await pageServers(client, user));

      const guildPageMatch = pathname.match(/^\/servers\/(\d+)(\/[\w-]*)?$/);
      if (guildPageMatch) {
        const guildId = guildPageMatch[1];
        const section = (guildPageMatch[2] || '/').replace('/', '') || 'overview';
        return sendHtml(await pageServerSettings(client, user, guildId, section));
      }
    } catch (err) {
      logger.error('[WebServer] Page render error:', err);
      res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
      return res.end('500 Internal Server Error');
    }

    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('404 Not Found');
  });

  server.listen(serverPort, () => {
    logger.info(`[WebServer] Dashboard listening on http://localhost:${serverPort} (web.enabled = true)`);
  });

  return server;
};

module.exports = { startWebServer, startHealthServer: startWebServer };
