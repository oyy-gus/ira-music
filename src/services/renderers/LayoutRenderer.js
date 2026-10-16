'use strict';

/**
 * Calculates bounded positions for elements based on alignment or custom X/Y coordinates.
 * Prevents elements from spilling outside canvas bounds (700 x 300).
 */
function computeLayoutPositions(cardConfig = {}, width = 700, height = 300) {
  const layout = cardConfig.layout || {};
  const align = layout.alignment || 'center';
  const spacing = typeof layout.spacing === 'number' ? layout.spacing : 10;

  let avatarX = 350;
  let avatarY = 75;
  let headingX = 350;
  let headingY = 160;
  let messageX = 350;
  let messageY = 198;
  let serverX = 350;
  let serverY = 238;

  if (align === 'left') {
    avatarX = 100;
    avatarY = height / 2;
    headingX = 220;
    headingY = 110;
    messageX = 220;
    messageY = 155;
    serverX = 220;
    serverY = 195;
  } else if (align === 'right') {
    avatarX = 600;
    avatarY = height / 2;
    headingX = 480;
    headingY = 110;
    messageX = 480;
    messageY = 155;
    serverX = 480;
    serverY = 195;
  } else {
    // center layout defaults
    avatarX = typeof layout.avatarX === 'number' ? layout.avatarX : 350;
    avatarY = typeof layout.avatarY === 'number' ? layout.avatarY : 75;
    headingX = typeof layout.headingX === 'number' ? layout.headingX : 350;
    headingY = typeof layout.headingY === 'number' ? layout.headingY : 160 + (spacing - 10);
    messageX = typeof layout.messageX === 'number' ? layout.messageX : 350;
    messageY = typeof layout.messageY === 'number' ? layout.messageY : 198 + (spacing - 10) * 1.5;
    serverX = typeof layout.serverX === 'number' ? layout.serverX : 350;
    serverY = typeof layout.serverY === 'number' ? layout.serverY : 238 + (spacing - 10) * 2;
  }

  // Enforce boundary safety [20 .. width-20], [20 .. height-20]
  const clamp = (val, min, max) => Math.max(min, Math.min(max, val));

  return {
    align,
    avatar: { x: clamp(avatarX, 40, width - 40), y: clamp(avatarY, 40, height - 40) },
    heading: { x: clamp(headingX, 20, width - 20), y: clamp(headingY, 20, height - 20) },
    message: { x: clamp(messageX, 20, width - 20), y: clamp(messageY, 20, height - 20) },
    server: { x: clamp(serverX, 20, width - 20), y: clamp(serverY, 20, height - 20) },
  };
}

module.exports = { computeLayoutPositions };
