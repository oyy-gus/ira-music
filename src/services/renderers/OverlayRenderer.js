'use strict';

/**
 * Render color overlay onto canvas context with controlled opacity.
 */
function renderOverlay(ctx, width, height, bgConfig = {}, colors = {}) {
  const enabled = bgConfig.overlay !== false;
  if (!enabled) return;

  const hexColor = bgConfig.overlayColor || colors.overlay || '#000000';
  const rawOpacity = typeof bgConfig.overlayOpacity === 'number' ? bgConfig.overlayOpacity : 50;
  const opacity = Math.max(0, Math.min(100, rawOpacity)) / 100;

  if (opacity <= 0) return;

  ctx.save();
  ctx.globalAlpha = opacity;
  ctx.fillStyle = hexColor;
  ctx.fillRect(0, 0, width, height);
  ctx.restore();
}

module.exports = { renderOverlay };
