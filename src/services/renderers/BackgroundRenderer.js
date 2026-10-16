'use strict';

/**
 * Render background onto canvas context.
 * Supports built-in procedurally generated themes and custom uploaded/external images.
 */
async function renderBackground(ctx, canvas, width, height, bgConfig = {}, colors = {}) {
  const bgType = bgConfig.type || 'builtin';
  const bgValue = bgConfig.value || 'default';
  const fit = bgConfig.fit || 'cover';
  const position = bgConfig.position || 'center';

  if (bgType === 'custom' && bgValue) {
    try {
      const img = await canvas.loadImage(bgValue).catch(() => null);
      if (img) {
        drawScaledImage(ctx, img, width, height, fit, position);
        return;
      }
    } catch (_) {}
  }

  // Fallback / Built-in presets
  switch (bgValue.toLowerCase()) {
    case 'aurora': {
      const g = ctx.createLinearGradient(0, 0, width, height);
      g.addColorStop(0, '#0c0721');
      g.addColorStop(0.4, '#1b103e');
      g.addColorStop(0.7, '#0f2b48');
      g.addColorStop(1, '#081627');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, width, height);

      // Aurora glow curves
      ctx.save();
      ctx.globalCompositeOperation = 'screen';
      ctx.fillStyle = 'rgba(139, 92, 246, 0.25)';
      ctx.beginPath();
      ctx.ellipse(width * 0.3, 0, 300, 120, 0.2, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = 'rgba(6, 182, 212, 0.2)';
      ctx.beginPath();
      ctx.ellipse(width * 0.7, height * 0.3, 260, 100, -0.3, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      break;
    }

    case 'midnight': {
      const g = ctx.createRadialGradient(width / 2, height / 2, 20, width / 2, height / 2, width * 0.75);
      g.addColorStop(0, '#1e293b');
      g.addColorStop(0.6, '#0f172a');
      g.addColorStop(1, '#020617');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, width, height);
      break;
    }

    case 'purple-glow': {
      const g = ctx.createRadialGradient(width * 0.5, height * 0.4, 10, width * 0.5, height * 0.4, width * 0.7);
      g.addColorStop(0, '#3b0764');
      g.addColorStop(0.5, '#1e0136');
      g.addColorStop(1, '#090014');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, width, height);

      ctx.save();
      ctx.fillStyle = 'rgba(168, 85, 247, 0.15)';
      ctx.beginPath();
      ctx.arc(width * 0.5, height * 0.4, 180, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      break;
    }

    case 'dark-waves': {
      ctx.fillStyle = '#0b0f19';
      ctx.fillRect(0, 0, width, height);

      ctx.save();
      const g1 = ctx.createLinearGradient(0, 0, width, height);
      g1.addColorStop(0, '#1e1b4b');
      g1.addColorStop(1, '#0f172a');
      ctx.fillStyle = g1;
      ctx.beginPath();
      ctx.moveTo(0, height * 0.3);
      ctx.bezierCurveTo(width * 0.35, height * 0.1, width * 0.65, height * 0.6, width, height * 0.3);
      ctx.lineTo(width, height);
      ctx.lineTo(0, height);
      ctx.closePath();
      ctx.fill();

      const g2 = ctx.createLinearGradient(0, height, width, 0);
      g2.addColorStop(0, 'rgba(99, 102, 241, 0.15)');
      g2.addColorStop(1, 'rgba(139, 92, 246, 0.05)');
      ctx.fillStyle = g2;
      ctx.beginPath();
      ctx.moveTo(0, height * 0.6);
      ctx.bezierCurveTo(width * 0.4, height * 0.8, width * 0.7, height * 0.4, width, height * 0.7);
      ctx.lineTo(width, height);
      ctx.lineTo(0, height);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
      break;
    }

    case 'abstract': {
      const g = ctx.createLinearGradient(0, 0, width, height);
      g.addColorStop(0, '#180e29');
      g.addColorStop(0.5, '#121026');
      g.addColorStop(1, '#090814');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, width, height);

      ctx.save();
      ctx.fillStyle = 'rgba(236, 72, 153, 0.12)';
      ctx.fillRect(50, -30, 200, 200);

      ctx.fillStyle = 'rgba(59, 130, 246, 0.12)';
      ctx.beginPath();
      ctx.arc(width - 60, height - 40, 160, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      break;
    }

    case 'space': {
      const g = ctx.createLinearGradient(0, 0, 0, height);
      g.addColorStop(0, '#030712');
      g.addColorStop(1, '#0b0d19');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, width, height);

      // Star particles
      ctx.save();
      ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
      const stars = [
        [40, 30, 1.5], [120, 80, 1], [220, 20, 2], [310, 90, 1.2],
        [450, 40, 1], [580, 70, 2], [650, 25, 1.5], [80, 180, 1],
        [190, 240, 1.8], [510, 220, 1.2], [630, 200, 1.5]
      ];
      for (const [sx, sy, sr] of stars) {
        ctx.beginPath();
        ctx.arc(sx, sy, sr, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
      break;
    }

    case 'gradient': {
      const pColor = colors.primary || '#8B5CF6';
      const sColor = colors.secondary || '#3B82F6';
      const g = ctx.createLinearGradient(0, 0, width, height);
      g.addColorStop(0, pColor);
      g.addColorStop(1, sColor);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, width, height);
      break;
    }

    case 'default':
    default: {
      const g = ctx.createRadialGradient(width * 0.5, height * 0.3, 10, width * 0.5, height * 0.5, width * 0.75);
      g.addColorStop(0, '#181b33');
      g.addColorStop(0.5, '#0e1121');
      g.addColorStop(1, '#070914');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, width, height);

      ctx.save();
      ctx.fillStyle = 'rgba(139, 92, 246, 0.12)';
      ctx.beginPath();
      ctx.arc(width / 2, height / 2 - 20, 180, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      break;
    }
  }
}

function drawScaledImage(ctx, img, width, height, fit, position) {
  const imgW = img.width || width;
  const imgH = img.height || height;
  let dx = 0, dy = 0, dw = width, dh = height;

  if (fit === 'stretch') {
    ctx.drawImage(img, 0, 0, width, height);
    return;
  }

  const imgRatio = imgW / imgH;
  const canvasRatio = width / height;

  if (fit === 'contain') {
    if (imgRatio > canvasRatio) {
      dw = width;
      dh = width / imgRatio;
    } else {
      dh = height;
      dw = height * imgRatio;
    }
  } else {
    // cover
    if (imgRatio > canvasRatio) {
      dh = height;
      dw = height * imgRatio;
    } else {
      dw = width;
      dh = width / imgRatio;
    }
  }

  // Positioning
  if (position.includes('left')) dx = 0;
  else if (position.includes('right')) dx = width - dw;
  else dx = (width - dw) / 2;

  if (position.includes('top')) dy = 0;
  else if (position.includes('bottom')) dy = height - dh;
  else dy = (height - dh) / 2;

  ctx.drawImage(img, dx, dy, dw, dh);
}

module.exports = { renderBackground };
