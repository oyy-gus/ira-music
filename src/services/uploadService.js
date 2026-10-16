'use strict';

const fs = require('fs');
const path = require('path');
const logger = require('../logger/logger');
const { getCanvas } = require('./renderers/GreetingCardRenderer');

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB
const ALLOWED_MIMES = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];
const ALLOWED_EXTS = ['.png', '.jpg', '.jpeg', '.webp'];

const UPLOAD_DIR = path.join(__dirname, '../web/public/uploads/backgrounds');

function ensureUploadDir() {
  if (!fs.existsSync(UPLOAD_DIR)) {
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  }
}

/**
 * Validate magic bytes of buffer to ensure genuine image format.
 */
function validateMagicBytes(buffer) {
  if (!buffer || buffer.length < 4) return false;

  // PNG: 89 50 4E 47
  if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) return 'png';

  // JPEG: FF D8 FF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return 'jpg';

  // WEBP: 52 49 46 46 ... 57 41 56 45 / 57 45 42 50
  if (buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46) {
    if (buffer.length >= 12 && buffer[8] === 0x57 && buffer[9] === 0x45 && buffer[10] === 0x42 && buffer[11] === 0x50) {
      return 'webp';
    }
  }

  return false;
}

/**
 * Validates and saves an uploaded custom background image.
 */
async function processBackgroundUpload(guildId, fileBuffer, mimeType = '', originalFilename = '') {
  if (!fileBuffer || !Buffer.isBuffer(fileBuffer)) {
    throw new Error('Invalid file payload.');
  }

  if (fileBuffer.length > MAX_FILE_SIZE) {
    throw new Error('File size exceeds 5MB limit.');
  }

  // Magic byte check
  const magicFormat = validateMagicBytes(fileBuffer);
  if (!magicFormat) {
    throw new Error('Invalid or corrupted image format (magic bytes check failed).');
  }

  const ext = path.extname(originalFilename).toLowerCase() || `.${magicFormat}`;
  if (!ALLOWED_EXTS.includes(ext)) {
    throw new Error(`Invalid file extension: ${ext}`);
  }

  // Attempt image decode via Canvas
  const canvas = getCanvas();
  if (!canvas) {
    throw new Error('Canvas renderer unavailable for image validation.');
  }

  let img = null;
  try {
    img = await canvas.loadImage(fileBuffer);
  } catch (err) {
    throw new Error('Image decoding failed. File may be corrupted or malicious.');
  }

  if (!img || img.width < 100 || img.height < 100) {
    throw new Error('Image dimensions must be at least 100x100 pixels.');
  }

  if (img.width > 3840 || img.height > 2160) {
    throw new Error('Image dimensions exceed maximum allowed resolution (3840x2160).');
  }

  ensureUploadDir();

  const safeFilename = `bg_${guildId}_${Date.now()}_${Math.floor(Math.random() * 1000)}${ext}`;
  const targetPath = path.join(UPLOAD_DIR, safeFilename);

  await fs.promises.writeFile(targetPath, fileBuffer);
  logger.info('[UploadService] Custom background saved', { guildId, filename: safeFilename });

  // Return public relative URL
  return `/uploads/backgrounds/${safeFilename}`;
}

module.exports = {
  processBackgroundUpload,
  validateMagicBytes,
};
