'use strict';

/**
 * Render avatar image or fallback initials with shapes (circle, rounded, square), border, and shadow.
 */
async function renderAvatar(ctx, canvas, avatarUrl, displayName, avatarConfig = {}, colors = {}, x = 350, y = 75) {
  const shape = avatarConfig.shape || 'circle';
  const size = Math.max(40, Math.min(220, avatarConfig.size || 100));
  const half = size / 2;
  const radius = shape === 'rounded' ? Math.floor(size * 0.2) : 0;

  // Shadow
  if (avatarConfig.shadow !== false) {
    ctx.save();
    const intensity = Math.max(0, Math.min(50, avatarConfig.shadowIntensity ?? 15));
    ctx.shadowColor = 'rgba(0, 0, 0, 0.6)';
    ctx.shadowBlur = intensity;
    ctx.shadowOffsetY = Math.floor(intensity / 3);

    ctx.fillStyle = '#000000';
    createShapePath(ctx, shape, x - half, y - half, size, size, radius);
    ctx.fill();
    ctx.restore();
  }

  // Avatar Image load
  let imgLoaded = false;
  if (avatarUrl) {
    try {
      const img = await canvas.loadImage(avatarUrl).catch(() => null);
      if (img) {
        ctx.save();
        createShapePath(ctx, shape, x - half, y - half, size, size, radius);
        ctx.clip();
        ctx.drawImage(img, x - half, y - half, size, size);
        ctx.restore();
        imgLoaded = true;
      }
    } catch (_) {}
  }

  // Fallback Initials
  if (!imgLoaded) {
    ctx.save();
    createShapePath(ctx, shape, x - half, y - half, size, size, radius);
    ctx.fillStyle = colors.primary || '#8B5CF6';
    ctx.fill();

    const letter = (displayName?.[0] || '?').toUpperCase();
    ctx.fillStyle = '#FFFFFF';
    ctx.font = `bold ${Math.floor(size * 0.45)}px Sans-Serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(letter, x, y);
    ctx.restore();
  }

  // Border
  if (avatarConfig.border !== false) {
    const bWidth = Math.max(1, Math.min(16, avatarConfig.borderWidth ?? 4));
    const bColor = avatarConfig.borderColor || colors.accent || colors.primary || '#8B5CF6';

    ctx.save();
    ctx.lineWidth = bWidth;
    ctx.strokeStyle = bColor;
    createShapePath(ctx, shape, x - half, y - half, size, size, radius);
    ctx.stroke();
    ctx.restore();
  }
}

function createShapePath(ctx, shape, x, y, width, height, borderRadius) {
  ctx.beginPath();
  if (shape === 'circle') {
    const cx = x + width / 2;
    const cy = y + height / 2;
    const r = width / 2;
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
  } else if (shape === 'rounded') {
    const r = borderRadius || 16;
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + width - r, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + r);
    ctx.lineTo(x + width, y + height - r);
    ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
    ctx.lineTo(x + r, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
  } else {
    // square
    ctx.rect(x, y, width, height);
  }
  ctx.closePath();
}

module.exports = { renderAvatar, createShapePath };
