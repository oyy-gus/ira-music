const { createCanvas, loadImage } = require('@napi-rs/canvas');
const { initFonts } = require('./fontLoader');
const { calculateProgression } = require('../services/xpService');
const { getCosmeticById, getSafeEquippedCosmetics } = require('../config/cosmetics');

// Initialize fonts
initFonts();

const FONT_FAMILY = '"Segoe UI Emoji", "Noto Color Emoji", "Apple Color Emoji", sans-serif';

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
 * Generate a standalone Level / Rank Canvas Card image buffer
 */
const generateLevelCard = async (user, userDoc, extraData = {}) => {
  const width = 800;
  const height = 240;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');

  const progLvl = calculateProgression(userDoc?.xp || 0);
  const equipped = getSafeEquippedCosmetics(
    userDoc?.equippedCosmetics || {},
    userDoc?.unlockedCosmetics || [],
    progLvl.level
  );
  const bgCosmetic = getCosmeticById(equipped.background);
  const glowCosmetic = getCosmeticById(equipped.glow);
  const frameCosmetic = getCosmeticById(equipped.frame);
  const emblemCosmetic = getCosmeticById(equipped.levelEmblem);
  const titleCosmetic = getCosmeticById(equipped.title);

  // Background Gradient
  const bgColors = bgCosmetic?.colors || ['#0d0e1b', '#161936', '#0a0a14'];
  const bgGrad = ctx.createLinearGradient(0, 0, width, height);
  bgGrad.addColorStop(0, bgColors[0]);
  bgGrad.addColorStop(0.5, bgColors[1] || bgColors[0]);
  bgGrad.addColorStop(1, bgColors[2] || bgColors[0]);
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, width, height);

  // Decorative Ambient Glow
  ctx.save();
  const glowColor = glowCosmetic?.color || 'rgba(88, 101, 242, 0.35)';
  ctx.beginPath();
  ctx.arc(100, 120, 150, 0, Math.PI * 2);
  ctx.fillStyle = glowColor;
  ctx.fill();

  ctx.beginPath();
  ctx.arc(720, 180, 160, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(87, 242, 135, 0.15)';
  ctx.fill();
  ctx.restore();

  // Glassmorphic Outer Border Box
  drawRoundedRect(ctx, 15, 15, width - 30, height - 30, 18, 'rgba(20, 22, 45, 0.75)', 'rgba(88, 101, 242, 0.35)', 1.5);

  // Avatar Section
  const avatarSize = 90;
  const avatarCX = 40 + avatarSize / 2;
  const avatarCY = 40 + avatarSize / 2;
  const avatarRadius = avatarSize / 2 + 1.5;

  // Avatar Glow
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
    ctx.fillStyle = '#5865F2';
    ctx.fill();
    ctx.restore();
  }

  // Avatar Frame Stroke (hugs avatar edge seamlessly)
  const frameColor = frameCosmetic?.color || '#5865F2';
  ctx.save();
  ctx.beginPath();
  ctx.arc(avatarCX, avatarCY, avatarSize / 2 + 1, 0, Math.PI * 2);
  ctx.strokeStyle = frameColor;
  ctx.lineWidth = 4;
  ctx.stroke();
  ctx.restore();

  // User Identity
  const displayName = user.nickname || user.displayName || user.globalName || user.username || 'User';

  ctx.font = `bold 22px ${FONT_FAMILY}`;
  const maxNameWidth = titleCosmetic?.name ? 260 : 420;
  const usernameText = truncateText(ctx, displayName, maxNameWidth);
  const nameWidth = ctx.measureText(usernameText).width;

  ctx.fillStyle = '#FFFFFF';
  ctx.fillText(usernameText, 150, 62);

  // Title tag next to username
  if (titleCosmetic?.name) {
    ctx.font = `bold 12px ${FONT_FAMILY}`;
    ctx.fillStyle = '#FEE75C';
    ctx.fillText(`[ ${titleCosmetic.name} ]`, 150 + nameWidth + 10, 62);
  }

  // Level Badge (Top Right)
  const userXP = userDoc?.xp || 0;
  const prog = calculateProgression(userXP);
  const emblemIcon = emblemCosmetic?.icon || '⭐';

  ctx.fillStyle = '#57F287';
  ctx.font = `bold 22px ${FONT_FAMILY}`;
  ctx.textAlign = 'right';
  ctx.fillText(`${emblemIcon} LEVEL ${prog.level}`, 760, 62);
  ctx.textAlign = 'left';

  // Global & Server Ranks (Middle Info Line)
  const globalRankText = extraData.globalRank ? `#${extraData.globalRank}` : 'N/A';
  const serverRankText = extraData.serverRank ? `#${extraData.serverRank}` : 'N/A';

  ctx.fillStyle = '#949BA4';
  ctx.font = `13px ${FONT_FAMILY}`;
  ctx.fillText(`Global Rank: `, 150, 95);
  ctx.fillStyle = '#FEE75C';
  ctx.font = `bold 13px ${FONT_FAMILY}`;
  ctx.fillText(globalRankText, 230, 95);

  ctx.fillStyle = '#949BA4';
  ctx.font = `13px ${FONT_FAMILY}`;
  ctx.fillText(`Server Rank: `, 300, 95);
  ctx.fillStyle = '#57F287';
  ctx.font = `bold 13px ${FONT_FAMILY}`;
  ctx.fillText(serverRankText, 385, 95);

  // XP Text (Right Aligned above bar)
  ctx.fillStyle = '#FFFFFF';
  ctx.font = `bold 13px ${FONT_FAMILY}`;
  ctx.textAlign = 'right';
  const xpStr = prog.level >= 1000 
    ? `${prog.totalXP.toLocaleString()} XP (MAX)`
    : `${prog.currentXP.toLocaleString()} / ${prog.requiredXP.toLocaleString()} XP (${prog.progressPercent}%)`;
  ctx.fillText(xpStr, 760, 118);
  ctx.textAlign = 'left';

  // XP Progress Bar
  const barX = 150;
  const barY = 130;
  const barWidth = 610;
  const barHeight = 20;

  // Bar Background
  drawRoundedRect(ctx, barX, barY, barWidth, barHeight, 10, 'rgba(255, 255, 255, 0.08)', null, 0);

  // Bar Fill
  const fillWidth = Math.max(10, Math.floor((barWidth * prog.progressPercent) / 100));
  const barGrad = ctx.createLinearGradient(barX, barY, barX + barWidth, barY);
  barGrad.addColorStop(0, '#5865F2');
  barGrad.addColorStop(1, '#57F287');
  drawRoundedRect(ctx, barX, barY, fillWidth, barHeight, 10, barGrad, null, 0);

  // Bottom Subtext (Remaining XP to next level)
  ctx.fillStyle = '#949BA4';
  ctx.font = `12px ${FONT_FAMILY}`;
  const nextText = prog.level >= 1000
    ? 'Maximum level reached!'
    : `${prog.xpToNextLevel.toLocaleString()} XP remaining to Level ${prog.level + 1}`;
  ctx.fillText(nextText, 150, 175);

  return canvas.toBuffer('image/png');
};

module.exports = {
  generateLevelCard,
};
