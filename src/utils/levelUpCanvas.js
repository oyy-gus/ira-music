const { createCanvas, loadImage } = require('@napi-rs/canvas');
const { initFonts } = require('./fontLoader');

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
 * Generate a Level-Up Canvas Banner image buffer
 */
const generateLevelUpCard = async (user, newLevel, emblemIcon = '⭐') => {
  const width = 720;
  const height = 200;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');

  // 1. Rich Background Gradient
  const bgGrad = ctx.createLinearGradient(0, 0, width, height);
  bgGrad.addColorStop(0, '#0e0c1f');
  bgGrad.addColorStop(0.5, '#1b1438');
  bgGrad.addColorStop(1, '#110d26');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, width, height);

  // 2. Soft Radial Glows (No harsh circular edges)
  ctx.save();
  const radGlow1 = ctx.createRadialGradient(80, 100, 10, 80, 100, 180);
  radGlow1.addColorStop(0, 'rgba(87, 242, 135, 0.18)');
  radGlow1.addColorStop(1, 'rgba(87, 242, 135, 0)');
  ctx.fillStyle = radGlow1;
  ctx.fillRect(0, 0, width, height);

  const radGlow2 = ctx.createRadialGradient(640, 100, 10, 640, 100, 200);
  radGlow2.addColorStop(0, 'rgba(235, 69, 158, 0.15)');
  radGlow2.addColorStop(1, 'rgba(235, 69, 158, 0)');
  ctx.fillStyle = radGlow2;
  ctx.fillRect(0, 0, width, height);
  ctx.restore();

  // 3. Glassmorphic Outer Card Border
  drawRoundedRect(
    ctx,
    12,
    12,
    width - 24,
    height - 24,
    16,
    'rgba(255, 255, 255, 0.02)',
    'rgba(87, 242, 135, 0.35)',
    1.5
  );

  // 4. User Avatar
  const avatarSize = 84;
  const avatarCX = 35 + avatarSize / 2;
  const avatarCY = 48 + avatarSize / 2;
  const avatarRadius = avatarSize / 2 + 1.5;

  // Avatar Soft Outer Glow
  ctx.save();
  ctx.beginPath();
  ctx.arc(avatarCX, avatarCY, avatarRadius + 4, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(87, 242, 135, 0.35)';
  ctx.fill();
  ctx.restore();

  // Draw Avatar Image — fills ring with zero gap
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
  } catch (e) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(avatarCX, avatarCY, avatarRadius, 0, Math.PI * 2);
    ctx.fillStyle = '#57F287';
    ctx.fill();
    ctx.restore();
  }

  // Avatar Border Ring (hugs outer avatar edge seamlessly)
  ctx.save();
  ctx.beginPath();
  ctx.arc(avatarCX, avatarCY, avatarSize / 2 + 1, 0, Math.PI * 2);
  ctx.strokeStyle = '#57F287';
  ctx.lineWidth = 4;
  ctx.stroke();
  ctx.restore();

  // 5. Header Title Text
  ctx.fillStyle = '#57F287';
  ctx.font = `bold 18px ${FONT_FAMILY}`;
  ctx.fillText('🎉 LEVEL UP!', 142, 54);

  // 6. User Display Name
  const displayName = user.nickname || user.displayName || user.globalName || user.username || 'User';
  ctx.fillStyle = '#FFFFFF';
  ctx.font = `bold 22px ${FONT_FAMILY}`;
  const nameText = truncateText(ctx, displayName, 340);
  ctx.fillText(nameText, 142, 86);

  // 7. Subtitle
  ctx.fillStyle = '#DBDEE1';
  ctx.font = `14px ${FONT_FAMILY}`;
  ctx.fillText(`advanced to Level ${newLevel}!`, 142, 112);

  // 8. Bottom Rewards Tip
  ctx.fillStyle = '#949BA4';
  ctx.font = `italic 11px ${FONT_FAMILY}`;
  ctx.fillText('🎁 New rewards & cosmetics unlocked! Use *cosmetics to view.', 142, 150);

  // 9. Sleek & Balanced "NEW LEVEL" Badge Box (Right Side)
  const badgeW = 150;
  const badgeH = 100;
  const badgeX = 535;
  const badgeY = 50;

  drawRoundedRect(
    ctx,
    badgeX,
    badgeY,
    badgeW,
    badgeH,
    14,
    'rgba(18, 20, 42, 0.85)',
    'rgba(254, 231, 92, 0.45)',
    1
  );

  ctx.fillStyle = '#FEE75C';
  ctx.font = `bold 12px ${FONT_FAMILY}`;
  ctx.textAlign = 'center';
  ctx.fillText('NEW LEVEL', badgeX + badgeW / 2, badgeY + 34);

  ctx.fillStyle = '#FFFFFF';
  ctx.font = `bold 32px ${FONT_FAMILY}`;
  ctx.fillText(`${emblemIcon} ${newLevel}`, badgeX + badgeW / 2, badgeY + 76);
  ctx.textAlign = 'left';

  return canvas.toBuffer('image/png');
};

module.exports = {
  generateLevelUpCard,
};
