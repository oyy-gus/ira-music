'use strict';

/**
 * Render avatar frame overlay.
 * Separated from AvatarRenderer for easy future expansion.
 */
function renderFrame(ctx, avatarConfig = {}, colors = {}, x = 350, y = 75) {
  const frameKey = (avatarConfig.frame || 'none').toLowerCase();
  if (frameKey === 'none') return;

  const size = Math.max(40, Math.min(220, avatarConfig.size || 100));
  const half = size / 2;
  const pColor = colors.primary || '#8B5CF6';
  const aColor = colors.accent || colors.primary || '#8B5CF6';
  const sColor = colors.secondary || '#3B82F6';

  ctx.save();

  switch (frameKey) {
    case 'glow': {
      ctx.shadowColor = aColor;
      ctx.shadowBlur = 24;
      ctx.lineWidth = 6;
      ctx.strokeStyle = aColor;
      ctx.beginPath();
      ctx.arc(x, y, half + 6, 0, Math.PI * 2);
      ctx.stroke();
      break;
    }

    case 'ring': {
      ctx.lineWidth = 5;
      ctx.strokeStyle = aColor;
      ctx.beginPath();
      ctx.arc(x, y, half + 8, 0, Math.PI * 2);
      ctx.stroke();

      // Small accent dots on top/bottom/left/right
      ctx.fillStyle = '#FFFFFF';
      const dots = [[x, y - half - 8], [x + half + 8, y], [x, y + half + 8], [x - half - 8, y]];
      for (const [dx, dy] of dots) {
        ctx.beginPath();
        ctx.arc(dx, dy, 3, 0, Math.PI * 2);
        ctx.fill();
      }
      break;
    }

    case 'double-ring': {
      ctx.lineWidth = 3;
      ctx.strokeStyle = aColor;
      ctx.beginPath();
      ctx.arc(x, y, half + 6, 0, Math.PI * 2);
      ctx.stroke();

      ctx.lineWidth = 2;
      ctx.strokeStyle = sColor;
      ctx.beginPath();
      ctx.arc(x, y, half + 12, 0, Math.PI * 2);
      ctx.stroke();
      break;
    }

    case 'classic': {
      ctx.lineWidth = 4;
      ctx.strokeStyle = '#F59E0B'; // Gold accent
      ctx.beginPath();
      ctx.arc(x, y, half + 6, 0, Math.PI * 2);
      ctx.stroke();

      ctx.lineWidth = 1.5;
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
      ctx.beginPath();
      ctx.arc(x, y, half + 10, 0, Math.PI * 2);
      ctx.stroke();
      break;
    }

    case 'ira': {
      // Signature Ira Music frame
      const g = ctx.createLinearGradient(x - half, y - half, x + half, y + half);
      g.addColorStop(0, pColor);
      g.addColorStop(0.5, aColor);
      g.addColorStop(1, sColor);

      ctx.lineWidth = 6;
      ctx.strokeStyle = g;
      ctx.beginPath();
      ctx.arc(x, y, half + 8, 0, Math.PI * 2);
      ctx.stroke();

      // Top musical note badge
      ctx.fillStyle = pColor;
      ctx.beginPath();
      ctx.arc(x, y - half - 8, 11, 0, Math.PI * 2);
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = '#FFFFFF';
      ctx.stroke();

      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 10px Sans-Serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('🎵', x, y - half - 7);
      break;
    }
  }

  ctx.restore();
}

module.exports = { renderFrame };
