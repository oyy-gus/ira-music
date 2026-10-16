const { createCanvas, loadImage } = require('@napi-rs/canvas');
const { initFonts } = require('./fontLoader');
const { formatDurationText } = require('./timeUtils');
const { calculateProgression } = require('../services/xpService');
const { getCosmeticById, getSafeEquippedCosmetics } = require('../config/cosmetics');
const { getSafeBadges } = require('../database/repositories/userRepository');

const { APPLICATION_EMOJIS } = require('../config/emojis');

// Initialize fonts for Canvas
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

const parseAndPreloadEmojiSegments = async (text) => {
  if (!text) return [];
  const regex = /<a?:([a-zA-Z0-9_]+):([0-9]+)>/g;
  const rawSegments = [];
  let lastIndex = 0;
  let match;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      rawSegments.push({
        type: 'text',
        content: text.slice(lastIndex, match.index),
      });
    }
    rawSegments.push({
      type: 'emoji',
      name: match[1],
      id: match[2],
      imagePromise: loadEmojiImage(match[2]),
    });
    lastIndex = regex.lastIndex;
  }

  if (lastIndex < text.length) {
    rawSegments.push({
      type: 'text',
      content: text.slice(lastIndex),
    });
  }

  const segments = [];
  for (const seg of rawSegments) {
    if (seg.type === 'emoji') {
      const image = await seg.imagePromise;
      segments.push({
        type: 'emoji',
        name: seg.name,
        id: seg.id,
        image,
      });
    } else {
      segments.push(seg);
    }
  }

  return segments;
};

const drawAboutWithCustomEmojis = async (ctx, rawAbout, textX, y, maxWidth) => {
  const textWithQuotes = `"${rawAbout}"`;
  const segments = await parseAndPreloadEmojiSegments(textWithQuotes);

  const emojiSize = 14;
  const emojiPadding = 3;

  let totalWidth = 0;
  const drawList = [];

  for (const seg of segments) {
    if (seg.type === 'text') {
      const segWidth = ctx.measureText(seg.content).width;
      if (totalWidth + segWidth <= maxWidth) {
        drawList.push({ type: 'text', content: seg.content, width: segWidth });
        totalWidth += segWidth;
      } else {
        const ellipsis = '...';
        const ellipsisWidth = ctx.measureText(ellipsis).width;
        let availableWidth = maxWidth - totalWidth - ellipsisWidth;
        if (availableWidth > 0) {
          let str = seg.content;
          let len = str.length;
          while (len > 0 && ctx.measureText(str.slice(0, len)).width > availableWidth) {
            len--;
          }
          const truncatedStr = str.slice(0, len) + ellipsis;
          const trWidth = ctx.measureText(truncatedStr).width;
          drawList.push({ type: 'text', content: truncatedStr, width: trWidth });
          totalWidth += trWidth;
        } else {
          if (drawList.length > 0 && drawList[drawList.length - 1].type === 'text') {
            const last = drawList[drawList.length - 1];
            last.content += ellipsis;
            last.width = ctx.measureText(last.content).width;
          }
        }
        break;
      }
    } else if (seg.type === 'emoji') {
      const segWidth = seg.image ? (emojiSize + emojiPadding) : ctx.measureText(`:${seg.name}:`).width;
      if (totalWidth + segWidth <= maxWidth) {
        drawList.push({ type: 'emoji', name: seg.name, image: seg.image, width: segWidth });
        totalWidth += segWidth;
      } else {
        const ellipsis = '...';
        if (maxWidth - totalWidth >= ctx.measureText(ellipsis).width) {
          drawList.push({ type: 'text', content: ellipsis, width: ctx.measureText(ellipsis).width });
        }
        break;
      }
    }
  }

  let currentX = textX;
  for (const item of drawList) {
    if (item.type === 'text') {
      ctx.fillText(item.content, currentX, y);
      currentX += item.width;
    } else if (item.type === 'emoji') {
      if (item.image) {
        const emojiY = y - 12;
        ctx.drawImage(item.image, currentX + 1, emojiY, emojiSize, emojiSize);
        currentX += item.width;
      } else {
        const fallbackStr = `:${item.name}:`;
        ctx.fillText(fallbackStr, currentX, y);
        currentX += ctx.measureText(fallbackStr).width;
      }
    }
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

const formatEmojiText = (str) => {
  if (!str) return '';
  return str
    .replace(/<a?:([a-zA-Z0-9_]+):[0-9]+>/g, ':$1:')
    .replace(/\s+/g, ' ')
    .trim();
};

const truncateText = (ctx, text, maxWidth) => {
  const formatted = formatEmojiText(text);
  if (!formatted) return '';
  let width = ctx.measureText(formatted).width;
  if (width <= maxWidth) return formatted;
  const ellipsis = '...';
  const ellipsisWidth = ctx.measureText(ellipsis).width;
  let len = formatted.length;
  let str = formatted;
  while (width + ellipsisWidth > maxWidth && len > 0) {
    len--;
    str = str.substring(0, len);
    width = ctx.measureText(str).width;
  }
  return str + ellipsis;
};

const generateProfileCard = async (user, userDoc, extraData = {}) => {
  const width = 900;
  const height = 580;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');

  const progEquip = calculateProgression(userDoc?.xp || 0);
  const equipped = getSafeEquippedCosmetics(
    userDoc?.equippedCosmetics || {},
    userDoc?.unlockedCosmetics || [],
    progEquip.level
  );
  const bgCosmetic = getCosmeticById(equipped.background);
  const glowCosmetic = getCosmeticById(equipped.glow);
  const frameCosmetic = getCosmeticById(equipped.frame);
  const decoCosmetic = getCosmeticById(equipped.decoration);
  const emblemCosmetic = getCosmeticById(equipped.levelEmblem);
  const titleCosmetic = getCosmeticById(equipped.title);
  const visCosmetic = getCosmeticById(equipped.visualizer);

  // 1. LAYER 1: Background
  const bgColors = bgCosmetic?.colors || ['#0d0e1b', '#13152c', '#0a0a14'];
  const bgGrad = ctx.createLinearGradient(0, 0, width, height);
  bgGrad.addColorStop(0, bgColors[0]);
  bgGrad.addColorStop(0.5, bgColors[1] || bgColors[0]);
  bgGrad.addColorStop(1, bgColors[2] || bgColors[0]);
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, width, height);

  // 2. LAYER 2-3: Background & Ambient Particles
  ctx.save();
  const glowColor = glowCosmetic?.color || 'rgba(88, 101, 242, 0.3)';
  ctx.beginPath();
  ctx.arc(120, 90, 160, 0, Math.PI * 2);
  ctx.fillStyle = glowColor;
  ctx.fill();

  ctx.beginPath();
  ctx.arc(800, 480, 190, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(235, 69, 158, 0.15)';
  ctx.fill();
  ctx.restore();

  // Glassmorphic Outer Border
  drawRoundedRect(ctx, 15, 15, width - 30, height - 30, 20, 'rgba(255, 255, 255, 0.03)', 'rgba(255, 255, 255, 0.1)', 1.5);

  // 4. LAYER 4: Profile Decoration Symbol / Ornament
  if (decoCosmetic?.symbol) {
    ctx.save();
    ctx.font = `28px ${FONT_FAMILY}`;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.fillText(decoCosmetic.symbol, 820, 60);
    ctx.fillText(decoCosmetic.symbol, 850, 90);
    ctx.restore();
  }

  // ==================== TOP IDENTITY & ABOUT SECTION ====================
  // Header Box (Top Panel)
  drawRoundedRect(ctx, 35, 35, 830, 155, 16, 'rgba(20, 22, 45, 0.70)', 'rgba(88, 101, 242, 0.35)', 1);

  // 5-7. LAYER 5-7: Avatar, Glow, Effect
  const avatarSize = 110;
  // Center avatar vertically within header box (box: y=35, h=155 → center at y=112)
  const avatarCX = 55 + avatarSize / 2 + 10;  // center X (left-aligned with padding)
  const avatarCY = 35 + 155 / 2;              // center Y of header box

  // Avatar Glow (soft outer glow circle)
  ctx.save();
  const innerR = avatarSize / 2;
  const outerR = avatarSize / 2 + 6;
  const glowGrad = ctx.createRadialGradient(avatarCX, avatarCY, innerR, avatarCX, avatarCY, outerR + 4);
  glowGrad.addColorStop(0, glowColor);
  glowGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.beginPath();
  ctx.arc(avatarCX, avatarCY, outerR + 4, 0, Math.PI * 2);
  ctx.fillStyle = glowGrad;
  ctx.fill();
  ctx.restore();

  // Avatar Drawing — offscreen compositing to guarantee avatar fills ring completely with zero gap
  const avatarRadius = avatarSize / 2 + 1.5;
  try {
    const avatarUrl = user.displayAvatarURL ? user.displayAvatarURL({ extension: 'png', size: 256 }) : '';
    if (avatarUrl) {
      const avatarImg = await loadImage(avatarUrl);

      const offSize = Math.ceil((avatarRadius + 5) * 2);
      const offCX = offSize / 2;
      const offCY = offSize / 2;

      const offscreen = createCanvas(offSize, offSize);
      const offCtx = offscreen.getContext('2d');
      offCtx.drawImage(avatarImg, 0, 0, offSize, offSize);

      offCtx.globalCompositeOperation = 'destination-in';
      offCtx.beginPath();
      offCtx.arc(offCX, offCY, avatarRadius, 0, Math.PI * 2);
      offCtx.closePath();
      offCtx.fillStyle = '#ffffff';
      offCtx.fill();

      ctx.drawImage(offscreen, avatarCX - offCX, avatarCY - offCY, offSize, offSize);
    }
  } catch (err) {
    // Fallback: plain filled circle
    ctx.save();
    ctx.beginPath();
    ctx.arc(avatarCX, avatarCY, avatarRadius, 0, Math.PI * 2);
    ctx.fillStyle = '#5865F2';
    ctx.fill();
    ctx.restore();
  }

  // 8. LAYER 8: Profile Frame Ring (Overlaps outer avatar edge directly for 0 gap)
  const frameColor = frameCosmetic?.color || '#5865F2';
  ctx.save();
  ctx.beginPath();
  ctx.arc(avatarCX, avatarCY, avatarSize / 2 + 1, 0, Math.PI * 2);
  ctx.strokeStyle = frameColor;
  ctx.lineWidth = 4;
  ctx.stroke();
  ctx.restore();

  // 10 & 14. LAYER 10 & 14: Username, Title & User ID
  const displayName = user.nickname || user.displayName || user.globalName || user.user?.displayName || user.username || user.user?.username || 'Unknown User';

  // Text starts right after avatar area: avatarCX + radius + padding
  const textX = Math.round(avatarCX + avatarSize / 2 + 20);

  ctx.font = `bold 24px ${FONT_FAMILY}`;
  const maxNameWidth = titleCosmetic?.name ? 300 : 530;
  const usernameText = truncateText(ctx, displayName, maxNameWidth);
  const nameWidth = ctx.measureText(usernameText).width;

  ctx.fillStyle = '#FFFFFF';
  ctx.fillText(usernameText, textX, 82);

  // Title tag next to username if equipped
  if (titleCosmetic?.name) {
    ctx.font = `bold 13px ${FONT_FAMILY}`;
    ctx.fillStyle = '#FEE75C';
    ctx.fillText(`[ ${titleCosmetic.name} ]`, textX + nameWidth + 12, 82);
  }

  const userId = user.id || user.user?.id || userDoc?.discordId;
  ctx.fillStyle = '#949BA4';
  ctx.font = `13px ${FONT_FAMILY}`;
  ctx.fillText(`ID: ${userId}`, textX, 105);

  // CRITICAL REQUIREMENT: ABOUT MUST REMAIN IN *PROFILE!
  const rawAbout = userDoc?.aboutMe || 'Music Enthusiast 🎧 | Enjoying live streams & beats';
  ctx.fillStyle = '#5865F2';
  ctx.font = `bold 12px ${FONT_FAMILY}`;
  ctx.fillText('ABOUT', textX, 130);

  ctx.fillStyle = '#DBDEE1';
  ctx.font = `italic 13px ${FONT_FAMILY}`;
  await drawAboutWithCustomEmojis(ctx, rawAbout, textX, 150, 830 - textX - 10);

  // ==================== PROGRESSION & LEVEL SECTION ====================
  const userXP = userDoc?.xp || 0;
  const prog = calculateProgression(userXP);
  const levelEmblemIcon = emblemCosmetic?.icon || '⭐';

  // Level & XP Box (Middle Panel)
  drawRoundedRect(ctx, 35, 205, 830, 125, 16, 'rgba(20, 22, 45, 0.70)', 'rgba(87, 242, 135, 0.35)', 1);

  const emblemImg = await loadEmojiImage(emblemCosmetic?.id || emblemCosmetic?.key || 'level_emblem') || await loadEmojiImage('star');
  ctx.fillStyle = '#57F287';
  ctx.font = `bold 20px ${FONT_FAMILY}`;
  if (emblemImg) {
    ctx.drawImage(emblemImg, 55, 242 - 18, 22, 22);
    ctx.fillText(`LEVEL ${prog.level}`, 83, 242);
  } else {
    ctx.fillText(`${levelEmblemIcon} LEVEL ${prog.level}`, 55, 242);
  }

  ctx.fillStyle = '#FFFFFF';
  ctx.font = `bold 14px ${FONT_FAMILY}`;
  const xpStr = prog.level >= 1000 
    ? `${prog.totalXP.toLocaleString()} XP (MAX LEVEL)`
    : `${prog.currentXP.toLocaleString()} / ${prog.requiredXP.toLocaleString()} XP (${prog.progressPercent}%)`;
  ctx.textAlign = 'right';
  ctx.fillText(xpStr, 845, 242);
  ctx.textAlign = 'left';

  // 12. LAYER 12: XP Progress Bar
  const barX = 55;
  const barY = 255;
  const barWidth = 790;
  const barHeight = 22;

  // Bar Background
  drawRoundedRect(ctx, barX, barY, barWidth, barHeight, 11, 'rgba(255, 255, 255, 0.08)', null, 0);

  // Bar Fill
  const fillWidth = Math.max(12, Math.floor((barWidth * prog.progressPercent) / 100));
  const barGrad = ctx.createLinearGradient(barX, barY, barX + barWidth, barY);
  barGrad.addColorStop(0, '#5865F2');
  barGrad.addColorStop(1, '#57F287');
  drawRoundedRect(ctx, barX, barY, fillWidth, barHeight, 11, barGrad, null, 0);

  // Next Level Text below progress bar
  ctx.fillStyle = '#949BA4';
  ctx.font = `12px ${FONT_FAMILY}`;
  const nextLvlText = prog.level >= 1000
    ? 'Maximum level reached!'
    : `${prog.xpToNextLevel.toLocaleString()} XP remaining to Level ${prog.level + 1}`;
  ctx.fillText(nextLvlText, 55, 305);

  // ==================== BOTTOM STATS & BADGES SECTION ====================
  // Stats Left Sub-panel
  drawRoundedRect(ctx, 35, 345, 400, 200, 16, 'rgba(20, 22, 45, 0.70)', 'rgba(255, 255, 255, 0.08)', 1);

  const listX = await drawHeaderIcon(ctx, ['listening', 'headphones', 'music'], '🎧', 55, 375, `bold 15px ${FONT_FAMILY}`, '#5865F2', 16);
  ctx.fillText('LISTENING PROGRESSION', listX, 375);

  // Listening Time
  const totalSec = userDoc?.statistics?.timeListenedSeconds || 0;
  const listenStr = formatDurationText(totalSec, { isSeconds: true });
  ctx.fillStyle = '#949BA4';
  ctx.font = `13px ${FONT_FAMILY}`;
  ctx.fillText('Listening Time:', 55, 410);
  ctx.fillStyle = '#FFFFFF';
  ctx.font = `bold 14px ${FONT_FAMILY}`;
  ctx.fillText(listenStr, 185, 410);

  // Global Rank & Server Rank
  const globalRankText = extraData.globalRank ? `#${extraData.globalRank}` : 'N/A';
  const serverRankText = extraData.serverRank ? `#${extraData.serverRank}` : 'N/A';

  ctx.fillStyle = '#949BA4';
  ctx.font = `13px ${FONT_FAMILY}`;
  ctx.fillText('Global Rank:', 55, 450);
  ctx.fillStyle = '#FEE75C';
  ctx.font = `bold 14px ${FONT_FAMILY}`;
  ctx.fillText(globalRankText, 185, 450);

  ctx.fillStyle = '#949BA4';
  ctx.font = `13px ${FONT_FAMILY}`;
  ctx.fillText('Server Rank:', 255, 450);
  ctx.fillStyle = '#57F287';
  ctx.font = `bold 14px ${FONT_FAMILY}`;
  ctx.fillText(serverRankText, 355, 450);

  // Tracks Played
  const tracksPlayed = userDoc?.statistics?.songsPlayed || 0;
  ctx.fillStyle = '#949BA4';
  ctx.font = `13px ${FONT_FAMILY}`;
  ctx.fillText('Tracks Played:', 55, 490);
  ctx.fillStyle = '#EB459E';
  ctx.font = `bold 14px ${FONT_FAMILY}`;
  ctx.fillText(`${tracksPlayed.toLocaleString()} tracks`, 185, 490);

  // Badges & Achievements Right Sub-panel
  drawRoundedRect(ctx, 455, 345, 410, 200, 16, 'rgba(20, 22, 45, 0.70)', 'rgba(255, 255, 255, 0.08)', 1);

  // 13. LAYER 13: Badges
  const badgeX = await drawHeaderIcon(ctx, ['badges', 'medal'], '🏅', 475, 375, `bold 15px ${FONT_FAMILY}`, '#FEE75C', 16);
  ctx.fillText('BADGES', badgeX, 375);

  // Badges — only show badges earned based on actual listening time (sanitized against DB)
  const totalListeningSec = userDoc?.statistics?.timeListenedSeconds || 0;
  const badges = getSafeBadges(userDoc?.badges, totalListeningSec);
  const badgeDisplay = badges.length > 0
    ? badges.slice(0, 6).join('  ')
    : 'No badges earned yet';
  ctx.fillStyle = badges.length > 0 ? '#FFFFFF' : 'rgba(255,255,255,0.35)';
  ctx.font = `15px ${FONT_FAMILY}`;
  ctx.fillText(truncateText(ctx, badgeDisplay, 370), 475, 410);

  // Achievements Summary
  const achX = await drawHeaderIcon(ctx, ['achievements', 'achievement', 'target'], '🎯', 475, 455, `bold 15px ${FONT_FAMILY}`, '#EB459E', 16);
  ctx.fillText('ACHIEVEMENTS', achX, 455);

  // Achievements — only show genuinely unlocked achievements, empty state if none
  const achievementsList = extraData.achievements || [];
  const achText = achievementsList.length > 0
    ? achievementsList.slice(0, 2).map((a) => `${a.icon || '🏆'} ${a.title}`).join('  •  ')
    : 'No achievements unlocked yet';
  ctx.fillStyle = achievementsList.length > 0 ? '#DBDEE1' : 'rgba(255,255,255,0.35)';
  ctx.font = `13px ${FONT_FAMILY}`;
  ctx.fillText(truncateText(ctx, achText, 370), 475, 490);
  // 16. LAYER 16: Optional Music Visualizer Cosmetic Decoration
  if (visCosmetic) {
    const visColor = visCosmetic.color || '#5865F2';
    const barHeights = [5, 9, 14, 7, 16, 11, 6, 13, 8, 10];
    const barWidth = 4;
    const barGap = 7;
    const startX = 770;
    const startY = 377;

    ctx.save();
    for (let i = 0; i < barHeights.length; i++) {
      const h = barHeights[i];
      drawRoundedRect(
        ctx,
        startX + i * barGap,
        startY - h,
        barWidth,
        h,
        2,
        visColor,
        null,
        0
      );
    }
    ctx.restore();
  }

  return canvas.toBuffer('image/png');
};

module.exports = {
  generateProfileCard,
};
