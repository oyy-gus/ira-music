const { createCanvas, loadImage } = require('@napi-rs/canvas');
const { initFonts } = require('./fontLoader');
const { formatDurationText } = require('./timeUtils');
const { getCosmeticById, getSafeEquippedCosmetics } = require('../config/cosmetics');
const { APPLICATION_EMOJIS } = require('../config/emojis');

// Initialize canvas fonts
initFonts();

const FONT_FAMILY = '"Segoe UI Emoji", "Noto Color Emoji", "Apple Color Emoji", sans-serif';

const emojiImageCache = new Map();

const loadEmojiImage = async (emojiKeyOrId) => {
  if (!emojiKeyOrId) return null;
  let cleanId = String(emojiKeyOrId).trim();

  if (APPLICATION_EMOJIS[cleanId.toLowerCase()]) {
    cleanId = APPLICATION_EMOJIS[cleanId.toLowerCase()].trim();
  }

  const tagMatch = /<a?:[a-zA-Z0-9_]+:([0-9]+)>/.exec(cleanId);
  if (tagMatch) {
    cleanId = tagMatch[1];
  }

  if (!cleanId || !/^[0-9]+$/.test(cleanId)) {
    return null;
  }

  if (emojiImageCache.has(cleanId)) {
    return emojiImageCache.get(cleanId);
  }
  const url = `https://cdn.discordapp.com/emojis/${cleanId}.png`;
  const promise = (async () => {
    try {
      const img = await loadImage(url);
      return img;
    } catch (err) {
      return null;
    }
  })();
  emojiImageCache.set(cleanId, promise);
  return promise;
};

const drawHeaderIcon = async (ctx, keys, fallbackUnicode, x, y, fontStyle, fillStyle, size = 16) => {
  let img = null;
  const keyList = Array.isArray(keys) ? keys : [keys];
  for (const k of keyList) {
    img = await loadEmojiImage(k);
    if (img) break;
  }

  ctx.font = fontStyle;
  ctx.fillStyle = fillStyle;

  if (img) {
    const emojiY = y - Math.floor(size * 0.85);
    ctx.drawImage(img, x, emojiY, size, size);
    return x + size + 6;
  } else {
    ctx.fillText(fallbackUnicode, x, y);
    return x + ctx.measureText(fallbackUnicode + ' ').width;
  }
};

const drawRoundedRect = (ctx, x, y, width, height, radius, fillStyle, strokeStyle, strokeWidth = 1) => {
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();

  if (fillStyle) {
    ctx.fillStyle = fillStyle;
    ctx.fill();
  }
  if (strokeStyle) {
    ctx.strokeStyle = strokeStyle;
    ctx.lineWidth = strokeWidth;
    ctx.stroke();
  }
  ctx.restore();
};

const truncateText = (ctx, text, maxWidth) => {
  if (!text) return '';
  let width = ctx.measureText(text).width;
  if (width <= maxWidth) return text;
  const ellipsis = '...';
  const ellipsisWidth = ctx.measureText(ellipsis).width;
  let len = text.length;
  let str = text;
  while (width + ellipsisWidth > maxWidth && len > 0) {
    len--;
    str = str.substring(0, len);
    width = ctx.measureText(str).width;
  }
  return str + ellipsis;
};

/**
 * Generate a high-fidelity Music Analytics Canvas Card
 * @param {Object} user - Discord User / GuildMember object
 * @param {Object} userDoc - Mongoose User document
 * @returns {Promise<Buffer>} PNG Buffer
 */
const generateMusicStatsCard = async (user, userDoc) => {
  const width = 850;
  const height = 520;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');

  // Validate equipped cosmetics against user's actual unlock level
  const userLevel = Math.max(userDoc?.level || 1);
  const equipped = getSafeEquippedCosmetics(
    userDoc?.equippedCosmetics || {},
    userDoc?.unlockedCosmetics || [],
    userLevel
  );
  const bgCosmetic = getCosmeticById(equipped.background);
  const glowCosmetic = getCosmeticById(equipped.glow);
  const frameCosmetic = getCosmeticById(equipped.frame);
  const titleCosmetic = getCosmeticById(equipped.title);

  // 1. Base Gradient Background
  const bgColors = bgCosmetic?.colors || ['#0d0e1b', '#161936', '#0a0a14'];
  const bgGrad = ctx.createLinearGradient(0, 0, width, height);
  bgGrad.addColorStop(0, bgColors[0]);
  bgGrad.addColorStop(0.5, bgColors[1] || bgColors[0]);
  bgGrad.addColorStop(1, bgColors[2] || bgColors[0]);
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, width, height);

  // 2. Ambient Glow Orbs
  ctx.save();
  const glowColor = glowCosmetic?.color || 'rgba(235, 69, 158, 0.3)';
  ctx.beginPath();
  ctx.arc(100, 100, 160, 0, Math.PI * 2);
  ctx.fillStyle = glowColor;
  ctx.fill();

  ctx.beginPath();
  ctx.arc(750, 420, 180, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(88, 101, 242, 0.2)';
  ctx.fill();

  ctx.beginPath();
  ctx.arc(425, 260, 200, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(87, 242, 135, 0.08)';
  ctx.fill();
  ctx.restore();

  // 3. Glassmorphic Outer Card Frame
  drawRoundedRect(
    ctx,
    15,
    15,
    width - 30,
    height - 30,
    20,
    'rgba(14, 16, 32, 0.78)',
    'rgba(235, 69, 158, 0.35)',
    1.5
  );

  // 4. Header Section
  const avatarSize = 80;
  const avatarCX = 35 + avatarSize / 2;
  const avatarCY = 32 + avatarSize / 2;
  const avatarRadius = avatarSize / 2 + 1.5;

  // Avatar Aura Glow
  ctx.save();
  ctx.beginPath();
  ctx.arc(avatarCX, avatarCY, avatarRadius + 4, 0, Math.PI * 2);
  ctx.fillStyle = glowColor;
  ctx.fill();
  ctx.restore();

  // Draw Avatar — fills ring with zero gap
  try {
    const avatarUrl = user.displayAvatarURL ? user.displayAvatarURL({ extension: 'png', size: 128 }) : '';
    if (avatarUrl) {
      const avatarImg = await loadImage(avatarUrl);
      ctx.save();
      ctx.beginPath();
      ctx.arc(avatarCX, avatarCY, avatarRadius, 0, Math.PI * 2);
      ctx.closePath();
      ctx.clip();
      ctx.drawImage(avatarImg, avatarCX - avatarRadius, avatarCY - avatarRadius, avatarRadius * 2, avatarRadius * 2);
      ctx.restore();
    }
  } catch (err) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(avatarCX, avatarCY, avatarRadius, 0, Math.PI * 2);
    ctx.fillStyle = '#EB459E';
    ctx.fill();
    ctx.restore();
  }

  // Avatar Frame Stroke (hugs outer avatar edge seamlessly)
  const frameColor = frameCosmetic?.color || '#EB459E';
  ctx.save();
  ctx.beginPath();
  ctx.arc(avatarCX, avatarCY, avatarSize / 2 + 1, 0, Math.PI * 2);
  ctx.strokeStyle = frameColor;
  ctx.lineWidth = 4;
  ctx.stroke();
  ctx.restore();

  // User Name & Details
  const displayName = user.nickname || user.displayName || user.globalName || user.username || 'User';
  const tag = user.user?.tag || user.tag || `@${user.username || 'user'}`;

  ctx.font = `bold 22px ${FONT_FAMILY}`;
  const maxNameWidth = titleCosmetic?.name ? 270 : 400;
  const nameText = truncateText(ctx, displayName, maxNameWidth);
  const nameWidth = ctx.measureText(nameText).width;

  ctx.fillStyle = '#FFFFFF';
  ctx.fillText(nameText, 130, 58);

  // Title tag next to username
  if (titleCosmetic?.name) {
    ctx.font = `bold 12px ${FONT_FAMILY}`;
    ctx.fillStyle = '#FEE75C';
    ctx.fillText(`[ ${titleCosmetic.name} ]`, 130 + nameWidth + 8, 58);
  }

  // Tag Subtext
  ctx.fillStyle = '#949BA4';
  ctx.font = `13px ${FONT_FAMILY}`;
  ctx.fillText(`${tag} • Music Listener Analytics`, 130, 82);

  // Header Title Pill (Top Right)
  const pillX = 615;
  const pillY = 38;
  const pillW = 200;
  const pillH = 38;

  const pillGrad = ctx.createLinearGradient(pillX, pillY, pillX + pillW, pillY);
  pillGrad.addColorStop(0, 'rgba(235, 69, 158, 0.25)');
  pillGrad.addColorStop(1, 'rgba(88, 101, 242, 0.25)');
  drawRoundedRect(ctx, pillX, pillY, pillW, pillH, 12, pillGrad, 'rgba(235, 69, 158, 0.5)', 1);

  const headIconImg = await loadEmojiImage('music_stats') || await loadEmojiImage('headphones') || await loadEmojiImage('analytics');
  ctx.fillStyle = '#FFFFFF';
  ctx.font = `bold 13px ${FONT_FAMILY}`;
  if (headIconImg) {
    const pillText = 'MUSIC ANALYTICS';
    const tw = ctx.measureText(pillText).width;
    const startX = pillX + (pillW - tw - 20) / 2;
    ctx.drawImage(headIconImg, startX, pillY + 11, 16, 16);
    ctx.fillText(pillText, startX + 22, pillY + 24);
  } else {
    ctx.textAlign = 'center';
    ctx.fillText('🎧 MUSIC ANALYTICS', pillX + pillW / 2, pillY + 24);
    ctx.textAlign = 'left';
  }

  // 5. Overview Metrics Grid (3 Stat Cards)
  const totalSec = userDoc?.statistics?.timeListenedSeconds || 0;
  const listenStr = formatDurationText(totalSec, { isSeconds: true }) || '0s';
  const tracksPlayed = userDoc?.statistics?.songsPlayed || 0;
  const topGuild = userDoc?.topGuilds?.[0];
  const topGuildName = topGuild?.guildName || 'None recorded';
  const topGuildCount = topGuild?.playCount ? `${topGuild.playCount} sessions` : '0 sessions';

  const metrics = [
    {
      keys: ['timer', 'stopwatch', 'clock', 'duration'],
      icon: '⏱️',
      label: 'TOTAL LISTENING TIME',
      value: listenStr,
      sub: 'Cumulative audio time',
      color: '#57F287',
      x: 35,
    },
    {
      keys: ['music_note', 'songs', 'music'],
      icon: '🎵',
      label: 'TRACKS PLAYED',
      value: `${tracksPlayed.toLocaleString()} songs`,
      sub: 'Total tracks queued',
      color: '#EB459E',
      x: 300,
    },
    {
      keys: ['server', 'home'],
      icon: '🏠',
      label: 'TOP SERVER',
      value: topGuildName,
      sub: topGuildCount,
      color: '#FEE75C',
      x: 565,
    },
  ];

  const cardW = 250;
  const cardH = 80;
  const cardY = 125;

  for (const m of metrics) {
    drawRoundedRect(
      ctx,
      m.x,
      cardY,
      cardW,
      cardH,
      12,
      'rgba(22, 25, 52, 0.65)',
      'rgba(255, 255, 255, 0.08)',
      1
    );

    // Accent left stripe
    drawRoundedRect(ctx, m.x + 10, cardY + 15, 4, cardH - 30, 2, m.color, null, 0);

    // Label with emoji
    const labelX = await drawHeaderIcon(ctx, m.keys, m.icon, m.x + 24, cardY + 26, `bold 10px ${FONT_FAMILY}`, '#949BA4', 12);
    ctx.fillText(m.label, labelX, cardY + 26);

    // Value
    ctx.fillStyle = '#FFFFFF';
    ctx.font = `bold 15px ${FONT_FAMILY}`;
    const valText = truncateText(ctx, m.value, cardW - 35);
    ctx.fillText(valText, m.x + 24, cardY + 48);

    // Subtext
    ctx.fillStyle = m.color;
    ctx.font = `11px ${FONT_FAMILY}`;
    const subText = truncateText(ctx, m.sub, cardW - 35);
    ctx.fillText(subText, m.x + 24, cardY + 65);
  }

  // 6. Bottom Panels (Top Songs & Top Companions)
  const panelY = 220;
  const panelW = 380;
  const panelH = 265;

  const medalKeys = [
    ['medal_1', 'gold_medal'],
    ['medal_2', 'silver_medal'],
    ['medal_3', 'bronze_medal'],
  ];
  const medals = ['🥇', '🥈', '🥉'];
  const topTracks = userDoc?.topTracks || [];
  const topCompanions = userDoc?.topCompanions || [];

  // Left Panel: Top 3 Songs
  const leftX = 35;
  drawRoundedRect(
    ctx,
    leftX,
    panelY,
    panelW,
    panelH,
    14,
    'rgba(20, 23, 48, 0.7)',
    'rgba(235, 69, 158, 0.25)',
    1
  );

  // Panel Header
  drawRoundedRect(
    ctx,
    leftX,
    panelY,
    panelW,
    38,
    14,
    'rgba(235, 69, 158, 0.15)',
    null,
    0
  );
  const songsHeadX = await drawHeaderIcon(ctx, ['top_tracks', 'songs', 'music_note'], '🎶', leftX + 16, panelY + 24, `bold 13px ${FONT_FAMILY}`, '#EB459E', 15);
  ctx.fillText('TOP 3 MOST PLAYED SONGS', songsHeadX, panelY + 24);

  // Rows for Songs
  if (topTracks.length > 0) {
    for (let idx = 0; idx < Math.min(topTracks.length, 3); idx++) {
      const track = topTracks[idx];
      const rowY = panelY + 50 + idx * 68;

      drawRoundedRect(
        ctx,
        leftX + 12,
        rowY,
        panelW - 24,
        60,
        10,
        'rgba(255, 255, 255, 0.03)',
        'rgba(255, 255, 255, 0.05)',
        1
      );

      // Medal Icon
      const medalImg = await loadEmojiImage(medalKeys[idx]?.[0]) || await loadEmojiImage(medalKeys[idx]?.[1]);
      if (medalImg) {
        ctx.drawImage(medalImg, leftX + 22, rowY + 20, 20, 20);
      } else {
        ctx.fillStyle = '#FFFFFF';
        ctx.font = `bold 18px ${FONT_FAMILY}`;
        ctx.fillText(medals[idx] || '🎵', leftX + 22, rowY + 36);
      }

      // Title & Artist
      ctx.fillStyle = '#FFFFFF';
      ctx.font = `bold 13px ${FONT_FAMILY}`;
      const titleStr = truncateText(ctx, track.title || 'Unknown Title', 210);
      ctx.fillText(titleStr, leftX + 54, rowY + 26);

      ctx.fillStyle = '#949BA4';
      ctx.font = `11px ${FONT_FAMILY}`;
      const authorStr = truncateText(ctx, `by ${track.author || 'Unknown'}`, 210);
      ctx.fillText(authorStr, leftX + 54, rowY + 44);

      // Play Count Pill
      const badgeText = `${track.playCount || 1}x plays`;
      ctx.font = `bold 11px ${FONT_FAMILY}`;
      const badgeW = ctx.measureText(badgeText).width + 16;
      const badgeX = leftX + panelW - 22 - badgeW;

      drawRoundedRect(
        ctx,
        badgeX,
        rowY + 18,
        badgeW,
        24,
        8,
        'rgba(235, 69, 158, 0.2)',
        'rgba(235, 69, 158, 0.4)',
        1
      );

      ctx.fillStyle = '#EB459E';
      ctx.fillText(badgeText, badgeX + 8, rowY + 34);
    }
  } else {
    ctx.fillStyle = '#949BA4';
    ctx.font = `13px ${FONT_FAMILY}`;
    ctx.textAlign = 'center';
    ctx.fillText('No track data recorded yet.', leftX + panelW / 2, panelY + panelH / 2 + 10);
    ctx.textAlign = 'left';
  }

  // Right Panel: Top 3 Companions
  const rightX = 435;
  drawRoundedRect(
    ctx,
    rightX,
    panelY,
    panelW,
    panelH,
    14,
    'rgba(20, 23, 48, 0.7)',
    'rgba(88, 101, 242, 0.25)',
    1
  );

  // Panel Header
  drawRoundedRect(
    ctx,
    rightX,
    panelY,
    panelW,
    38,
    14,
    'rgba(88, 101, 242, 0.15)',
    null,
    0
  );
  const compHeadX = await drawHeaderIcon(ctx, ['companions', 'people', 'user'], '👥', rightX + 16, panelY + 24, `bold 13px ${FONT_FAMILY}`, '#5865F2', 15);
  ctx.fillText('TOP 3 MUSIC COMPANIONS', compHeadX, panelY + 24);

  // Rows for Companions
  if (topCompanions.length > 0) {
    for (let idx = 0; idx < Math.min(topCompanions.length, 3); idx++) {
      const comp = topCompanions[idx];
      const rowY = panelY + 50 + idx * 68;

      drawRoundedRect(
        ctx,
        rightX + 12,
        rowY,
        panelW - 24,
        60,
        10,
        'rgba(255, 255, 255, 0.03)',
        'rgba(255, 255, 255, 0.05)',
        1
      );

      // Medal Icon
      const medalImg = await loadEmojiImage(medalKeys[idx]?.[0]) || await loadEmojiImage(medalKeys[idx]?.[1]);
      if (medalImg) {
        ctx.drawImage(medalImg, rightX + 22, rowY + 20, 20, 20);
      } else {
        ctx.fillStyle = '#FFFFFF';
        ctx.font = `bold 18px ${FONT_FAMILY}`;
        ctx.fillText(medals[idx] || '👤', rightX + 22, rowY + 36);
      }

      // Username
      ctx.fillStyle = '#FFFFFF';
      ctx.font = `bold 13px ${FONT_FAMILY}`;
      const nameStr = truncateText(ctx, `@${comp.username || 'User'}`, 210);
      ctx.fillText(nameStr, rightX + 54, rowY + 26);

      ctx.fillStyle = '#949BA4';
      ctx.font = `11px ${FONT_FAMILY}`;
      ctx.fillText('Listening Companion', rightX + 54, rowY + 44);

      // Listen Count Badge
      const badgeText = `${comp.listenCount || 1}x together`;
      ctx.font = `bold 11px ${FONT_FAMILY}`;
      const badgeW = ctx.measureText(badgeText).width + 16;
      const badgeX = rightX + panelW - 22 - badgeW;

      drawRoundedRect(
        ctx,
        badgeX,
        rowY + 18,
        badgeW,
        24,
        8,
        'rgba(87, 242, 135, 0.2)',
        'rgba(87, 242, 135, 0.4)',
        1
      );

      ctx.fillStyle = '#57F287';
      ctx.fillText(badgeText, badgeX + 8, rowY + 34);
    }
  } else {
    ctx.fillStyle = '#949BA4';
    ctx.font = `13px ${FONT_FAMILY}`;
    ctx.textAlign = 'center';
    ctx.fillText('No companion data recorded yet.', rightX + panelW / 2, panelY + panelH / 2 + 10);
    ctx.textAlign = 'left';
  }

  return canvas.toBuffer('image/png');
};

module.exports = {
  generateMusicStatsCard,
};
