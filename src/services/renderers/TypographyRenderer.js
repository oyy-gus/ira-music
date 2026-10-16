'use strict';

/**
 * Helper to render styled typography onto canvas context with boundary protection.
 */
function renderText(ctx, text, options = {}) {
  if (!text) return;

  const {
    x = 350,
    y = 160,
    maxWidth = 640,
    fontFamily = 'Sans-Serif',
    fontSize = 24,
    fontWeight = 'bold',
    color = '#FFFFFF',
    align = 'center',
    baseline = 'alphabetic',
  } = options;

  ctx.save();
  ctx.fillStyle = color;
  ctx.font = `${fontWeight} ${fontSize}px ${fontFamily}, Sans-Serif`;
  ctx.textAlign = align;
  ctx.textBaseline = baseline;

  // Safe truncation if text exceeds maxWidth
  let str = String(text);
  if (ctx.measureText(str).width > maxWidth) {
    while (str.length > 3 && ctx.measureText(str + '…').width > maxWidth) {
      str = str.slice(0, -1);
    }
    str += '…';
  }

  ctx.fillText(str, x, y);
  ctx.restore();
}

/**
 * Format font family string safely (reject external URLs or unsafe strings).
 */
function resolveFontFamily(fontName) {
  const safeFonts = ['Poppins', 'Inter', 'Roboto', 'Montserrat', 'Outfit', 'Segoe UI', 'Arial', 'Sans-Serif'];
  if (!fontName || typeof fontName !== 'string') return 'Sans-Serif';
  const match = safeFonts.find(f => f.toLowerCase() === fontName.toLowerCase());
  return match || 'Sans-Serif';
}

module.exports = { renderText, resolveFontFamily };
