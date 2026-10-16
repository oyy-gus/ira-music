const fs = require('fs');
const path = require('path');
const { GlobalFonts } = require('@napi-rs/canvas');
const logger = require('../logger/logger');

let initialized = false;
let registeredFonts = new Set();

/**
 * Initializes and registers fonts for @napi-rs/canvas.
 * Safe to call multiple times (idempotent).
 * Works seamlessly on Windows, Linux (NAT VPS), Docker, and macOS.
 */
function initFonts() {
  if (initialized) {
    return registeredFonts;
  }
  initialized = true;

  const fontsDir = path.join(process.cwd(), 'src', 'assets', 'fonts');

  // Ensure local fonts directory exists
  if (!fs.existsSync(fontsDir)) {
    try {
      fs.mkdirSync(fontsDir, { recursive: true });
    } catch (e) {
      logger.warn(`[FontLoader] Failed to create fonts directory ${fontsDir}:`, e.message);
    }
  }

  // Windows Localhost Helper: Automatically copy Segoe UI Emoji font to src/assets/fonts/ if available
  if (process.platform === 'win32') {
    const winEmojiPath = 'C:/Windows/Fonts/seguiemj.ttf';
    const bundledEmojiPath = path.join(fontsDir, 'seguiemj.ttf');

    if (fs.existsSync(winEmojiPath) && !fs.existsSync(bundledEmojiPath)) {
      try {
        fs.copyFileSync(winEmojiPath, bundledEmojiPath);
        logger.info('[FontLoader] Automatically bundled Segoe UI Emoji font to src/assets/fonts/ for VPS deployment.');
      } catch (e) {
        logger.warn('[FontLoader] Failed to copy Windows Emoji font:', e.message);
      }
    }
  }

  // 1. Register all font files present in src/assets/fonts/
  if (fs.existsSync(fontsDir)) {
    const files = fs.readdirSync(fontsDir);
    for (const file of files) {
      const ext = path.extname(file).toLowerCase();
      if (['.ttf', '.otf', '.ttc'].includes(ext)) {
        const fontPath = path.join(fontsDir, file);
        try {
          const alias = file.toLowerCase().includes('seguiemj') ? 'Segoe UI Emoji' : path.basename(file, ext);
          GlobalFonts.registerFromPath(fontPath, alias);
          registeredFonts.add(alias);
          logger.info(`[FontLoader] Registered bundled font: ${file} (alias: ${alias})`);
        } catch (e) {
          logger.warn(`[FontLoader] Failed to register bundled font ${file}:`, e.message);
        }
      }
    }
  }

  // 2. Scan standard OS font locations (Linux / Windows / macOS)
  const candidateFontPaths = [
    // Windows
    { path: 'C:/Windows/Fonts/seguiemj.ttf', alias: 'Segoe UI Emoji' },
    { path: 'C:/Windows/Fonts/arial.ttf', alias: 'Arial' },
    { path: 'C:/Windows/Fonts/segoeui.ttf', alias: 'Segoe UI' },

    // Linux (Debian, Ubuntu, CentOS, Alpine)
    { path: '/usr/share/fonts/truetype/noto/NotoColorEmoji.ttf', alias: 'Noto Color Emoji' },
    { path: '/usr/share/fonts/noto/NotoColorEmoji.ttf', alias: 'Noto Color Emoji' },
    { path: '/usr/share/fonts/noto-emoji/NotoColorEmoji.ttf', alias: 'Noto Color Emoji' },
    { path: '/usr/share/fonts/google-noto-emoji/NotoColorEmoji.ttf', alias: 'Noto Color Emoji' },
    { path: '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', alias: 'DejaVu Sans' },
    { path: '/usr/share/fonts/dejavu/DejaVuSans.ttf', alias: 'DejaVu Sans' },
    { path: '/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf', alias: 'Liberation Sans' },

    // macOS
    { path: '/System/Library/Fonts/Apple Color Emoji.ttc', alias: 'Apple Color Emoji' }
  ];

  for (const item of candidateFontPaths) {
    if (fs.existsSync(item.path)) {
      try {
        GlobalFonts.registerFromPath(item.path, item.alias);
        registeredFonts.add(item.alias);
        logger.info(`[FontLoader] Registered system font: ${item.path} (alias: ${item.alias})`);
      } catch (e) {
        logger.warn(`[FontLoader] Failed to register system font ${item.path}:`, e.message);
      }
    }
  }

  logger.info(`[FontLoader] Total registered fonts: ${Array.from(registeredFonts).join(', ') || 'None (Using Canvas default)'}`);
  return registeredFonts;
}

module.exports = {
  initFonts
};
