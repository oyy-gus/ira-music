'use strict';

const { renderBackground } = require('./BackgroundRenderer');
const { renderOverlay } = require('./OverlayRenderer');
const { renderAvatar } = require('./AvatarRenderer');
const { renderFrame } = require('./FrameRenderer');
const { renderText, resolveFontFamily } = require('./TypographyRenderer');
const { computeLayoutPositions } = require('./LayoutRenderer');

let _canvas = null;
const getCanvas = () => {
  if (_canvas) return _canvas;
  try { _canvas = require('@napi-rs/canvas'); return _canvas; } catch (_) {}
  try { _canvas = require('canvas'); return _canvas; } catch (_) {}
  return null;
};

/**
 * Main GreetingCardRenderer for both Welcome & Leave cards.
 * Orchestrates background, overlay, avatar, frame, typography, layout, and element visibility.
 */
async function renderGreetingCard(options = {}) {
  const canvas = getCanvas();
  if (!canvas) return null;

  const {
    type = 'welcome',
    displayName = 'User',
    username = 'user',
    avatarUrl = null,
    guildName = 'Server',
    guildIconUrl = null,
    memberCount = 1,
    memberNumber = 1,
    cardConfig = {},
    customMessageText = '',
  } = options;

  const width = 700;
  const height = 300;

  const cv = canvas.createCanvas(width, height);
  const ctx = cv.getContext('2d');

  // Config extractions with safe fallbacks
  const colors = cardConfig.colors || {};
  const primaryColor = colors.primary || (type === 'welcome' ? '#8B5CF6' : '#EF4444');
  const secondaryColor = colors.secondary || '#3B82F6';
  const textColor = colors.text || '#FFFFFF';
  const subtextColor = colors.subtext || '#9CA3AF';
  const accentColor = colors.accent || primaryColor;

  const bgConfig = cardConfig.background || {};
  const fonts = cardConfig.fonts || {};
  const headingFont = resolveFontFamily(fonts.heading);
  const bodyFont = resolveFontFamily(fonts.body);

  const typo = cardConfig.typography || {};
  const hSize = typo.headingSize || 28;
  const hWeight = typo.headingWeight || 'bold';
  const bSize = typo.bodySize || 16;
  const bWeight = typo.bodyWeight || 'normal';
  const metaSize = typo.memberNumberSize || 14;
  const align = typo.alignment || cardConfig.layout?.alignment || 'center';

  const avatarConfig = cardConfig.avatar || {};
  const visibility = cardConfig.visibility || {
    avatar: true,
    heading: true,
    message: true,
    serverName: true,
    memberNumber: true,
    memberCount: true,
    serverIcon: false,
  };

  const coords = computeLayoutPositions(cardConfig, width, height);

  // 1. Render Background
  await renderBackground(ctx, canvas, width, height, bgConfig, { primary: primaryColor, secondary: secondaryColor });

  // 2. Render Overlay
  renderOverlay(ctx, width, height, bgConfig, { overlay: colors.overlay || '#000000' });

  // 3. Render Avatar & Frame
  if (visibility.avatar !== false) {
    await renderAvatar(
      ctx,
      canvas,
      avatarUrl,
      displayName,
      avatarConfig,
      { primary: primaryColor, accent: accentColor },
      coords.avatar.x,
      coords.avatar.y
    );
    renderFrame(
      ctx,
      avatarConfig,
      { primary: primaryColor, accent: accentColor, secondary: secondaryColor },
      coords.avatar.x,
      coords.avatar.y
    );
  }

  // 4. Render Heading (e.g. WELCOME, DISPLAYNAME)
  if (visibility.heading !== false) {
    const headingText = type === 'welcome'
      ? `WELCOME, ${displayName.toUpperCase()}`
      : `GOODBYE, ${displayName.toUpperCase()}`;

    renderText(ctx, headingText, {
      x: coords.heading.x,
      y: coords.heading.y,
      maxWidth: align === 'center' ? 640 : 440,
      fontFamily: headingFont,
      fontSize: hSize,
      fontWeight: hWeight,
      color: textColor,
      align,
    });
  }

  // 5. Render Banner Subtitle (Clean card subtitle, separate from chat message caption)
  if (visibility.message !== false) {
    const subText = type === 'welcome'
      ? `Welcome to ${guildName}!`
      : `We'll miss you!`;

    renderText(ctx, subText, {
      x: coords.message.x,
      y: coords.message.y,
      maxWidth: align === 'center' ? 620 : 440,
      fontFamily: bodyFont,
      fontSize: bSize,
      fontWeight: bWeight,
      color: accentColor,
      align,
    });
  }

  // 6. Render Server Info & Member Count Meta
  const metaParts = [];
  if (visibility.serverName !== false) metaParts.push(guildName);
  if (type === 'welcome') {
    if (visibility.memberNumber !== false) metaParts.push(`Member #${memberNumber}`);
    if (visibility.memberCount !== false) metaParts.push(`${memberCount} members`);
  } else {
    if (visibility.memberCount !== false) metaParts.push(`${memberCount} members remaining`);
  }

  if (metaParts.length > 0) {
    const metaString = metaParts.join('  •  ');
    renderText(ctx, metaString, {
      x: coords.server.x,
      y: coords.server.y,
      maxWidth: align === 'center' ? 620 : 440,
      fontFamily: bodyFont,
      fontSize: metaSize,
      fontWeight: 'normal',
      color: subtextColor,
      align,
    });
  }

  return cv.toBuffer('image/png');
}

module.exports = { renderGreetingCard, getCanvas };
