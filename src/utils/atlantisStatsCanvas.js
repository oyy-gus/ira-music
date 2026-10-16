'use strict';

const { createCanvas, loadImage } = require('@napi-rs/canvas');
const { initFonts } = require('./fontLoader');

// Ensure system and bundled fonts are registered
initFonts();

const FONT_FAMILY = '"Segoe UI", "Segoe UI Emoji", Arial, sans-serif';

const formatDuration = (ms) => {
  if (!ms || ms <= 0) return '0m';
  const totalSec = Math.floor(ms / 1000);
  const days = Math.floor(totalSec / 86400);
  const hours = Math.floor((totalSec % 86400) / 3600);
  const mins = Math.floor((totalSec % 3600) / 60);

  const parts = [];
  if (days > 0) parts.push(`${days}D`);
  if (hours > 0) parts.push(`${hours}H`);
  parts.push(`${mins}m`);
  return parts.join(' ');
};

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
 * Generate high-definition Global OwO Stats Canvas Card
 * @param {Object} options
 * @param {import('discord.js').User} options.user
 * @param {Object} options.stats
 * @returns {Promise<Buffer>} PNG Buffer
 */
const generateGlobalOwoStatsCard = async ({ user, stats = {} }) => {
  const width = 900;
  const height = 540;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');

  // 1. Base Gradient Background
  const bgGrad = ctx.createLinearGradient(0, 0, width, height);
  bgGrad.addColorStop(0, '#0c0d1c');
  bgGrad.addColorStop(0.5, '#141632');
  bgGrad.addColorStop(1, '#090a14');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, width, height);

  // 2. Ambient Radiant Glows
  ctx.save();
  const radGlow1 = ctx.createRadialGradient(160, 120, 10, 160, 120, 260);
  radGlow1.addColorStop(0, 'rgba(139, 92, 246, 0.22)');
  radGlow1.addColorStop(1, 'rgba(139, 92, 246, 0)');
  ctx.fillStyle = radGlow1;
  ctx.fillRect(0, 0, width, height);

  const radGlow2 = ctx.createRadialGradient(760, 420, 10, 760, 420, 240);
  radGlow2.addColorStop(0, 'rgba(6, 182, 212, 0.16)');
  radGlow2.addColorStop(1, 'rgba(6, 182, 212, 0)');
  ctx.fillStyle = radGlow2;
  ctx.fillRect(0, 0, width, height);
  ctx.restore();

  // 3. Card Outer Frame Border
  drawRoundedRect(ctx, 16, 16, width - 32, height - 32, 22, 'rgba(20, 24, 48, 0.4)', 'rgba(255, 255, 255, 0.08)', 1.5);

  // 4. Header: User Avatar & Info
  const avatarSize = 82;
  const avatarX = 40;
  const avatarY = 38;

  let avatarImg = null;
  try {
    const avatarUrl = user.displayAvatarURL ? user.displayAvatarURL({ extension: 'png', size: 256 }) : user.avatarURL;
    if (avatarUrl) avatarImg = await loadImage(avatarUrl);
  } catch (_) {}

  // Avatar Glow Ring
  ctx.save();
  ctx.beginPath();
  ctx.arc(avatarX + avatarSize / 2, avatarY + avatarSize / 2, avatarSize / 2 + 3, 0, Math.PI * 2);
  ctx.strokeStyle = '#8B5CF6';
  ctx.lineWidth = 3;
  ctx.shadowColor = '#8B5CF6';
  ctx.shadowBlur = 14;
  ctx.stroke();
  ctx.restore();

  // Avatar Image Clip
  ctx.save();
  ctx.beginPath();
  ctx.arc(avatarX + avatarSize / 2, avatarY + avatarSize / 2, avatarSize / 2, 0, Math.PI * 2);
  ctx.closePath();
  ctx.clip();
  if (avatarImg) {
    ctx.drawImage(avatarImg, avatarX, avatarY, avatarSize, avatarSize);
  } else {
    ctx.fillStyle = '#6366F1';
    ctx.fillRect(avatarX, avatarY, avatarSize, avatarSize);
  }
  ctx.restore();

  // User Name & Tag
  const textX = avatarX + avatarSize + 18;
  const username = user.displayName || user.globalName || user.username || 'User';
  const userTag = user.tag || (user.discriminator && user.discriminator !== '0' ? `${user.username}#${user.discriminator}` : `@${user.username}`);

  ctx.font = `bold 24px ${FONT_FAMILY}`;
  ctx.fillStyle = '#FFFFFF';
  ctx.fillText(truncateText(ctx, username, 380), textX, avatarY + 28);

  ctx.font = `600 13px ${FONT_FAMILY}`;
  ctx.fillStyle = '#94A3B8';
  ctx.fillText(truncateText(ctx, userTag, 320), textX, avatarY + 50);

  // User ID Chip
  drawRoundedRect(ctx, textX, avatarY + 58, 170, 22, 6, 'rgba(139, 92, 246, 0.15)', 'rgba(139, 92, 246, 0.35)', 1);
  ctx.font = `600 10.5px ${FONT_FAMILY}`;
  ctx.fillStyle = '#C4B5FD';
  ctx.fillText(`ID: ${user.id}`, textX + 10, avatarY + 73);

  // Top-Right Header Badge: Global Community
  const badgeWidth = 240;
  const badgeX = width - 40 - badgeWidth;
  drawRoundedRect(ctx, badgeX, 38, badgeWidth, 68, 14, 'rgba(139, 92, 246, 0.12)', 'rgba(139, 92, 246, 0.35)', 1.2);

  ctx.font = `bold 13px ${FONT_FAMILY}`;
  ctx.fillStyle = '#A78BFA';
  ctx.fillText('🌐 GLOBAL OWO STATS', badgeX + 16, 62);

  ctx.font = `500 11.5px ${FONT_FAMILY}`;
  ctx.fillStyle = '#94A3B8';
  ctx.fillText('All Discord Servers Combined', badgeX + 16, 84);

  // 5. Four Primary Stat Cards (Lifetime)
  const cardY = 138;
  const cardH = 100;
  const cardW = 194;
  const cardGap = 16;
  const startX = 40;

  const statCards = [
    { label: 'TOTAL OWO & UWU', value: (stats.owoCount || 0).toLocaleString(), icon: '💬', color: '#EC4899', glow: 'rgba(236, 72, 153, 0.15)' },
    { label: 'TOTAL HUNTS', value: (stats.huntCount || 0).toLocaleString(), icon: '🏹', color: '#06B6D4', glow: 'rgba(6, 182, 212, 0.15)' },
    { label: 'TOTAL BATTLES', value: (stats.battleCount || 0).toLocaleString(), icon: '⚔️', color: '#F59E0B', glow: 'rgba(245, 158, 11, 0.15)' },
    { label: 'TOTAL PRAYS', value: (stats.praycurseCount || 0).toLocaleString(), icon: '🙏', color: '#8B5CF6', glow: 'rgba(139, 92, 246, 0.15)' },
  ];

  statCards.forEach((c, i) => {
    const x = startX + i * (cardW + cardGap);
    // Card background
    drawRoundedRect(ctx, x, cardY, cardW, cardH, 14, 'rgba(255, 255, 255, 0.035)', 'rgba(255, 255, 255, 0.08)', 1);

    // Accent top border strip
    ctx.save();
    ctx.beginPath();
    ctx.strokeStyle = c.color;
    ctx.lineWidth = 3;
    ctx.moveTo(x + 18, cardY);
    ctx.lineTo(x + cardW - 18, cardY);
    ctx.stroke();
    ctx.restore();

    // Icon + Label
    ctx.font = `bold 10px ${FONT_FAMILY}`;
    ctx.fillStyle = '#94A3B8';
    ctx.fillText(`${c.icon} ${c.label}`, x + 14, cardY + 28);

    // Value
    ctx.font = `bold 24px ${FONT_FAMILY}`;
    ctx.fillStyle = '#FFFFFF';
    ctx.fillText(truncateText(ctx, c.value, cardW - 28), x + 14, cardY + 68);
  });

  // 6. HuntBot Highlights (2 Horizontal Strips)
  const hbY = 254;
  const hbW = 402;
  const hbH = 56;
  const hbGap = 16;

  // HuntBot Completed
  drawRoundedRect(ctx, startX, hbY, hbW, hbH, 12, 'rgba(16, 185, 129, 0.08)', 'rgba(16, 185, 129, 0.25)', 1);
  ctx.font = `bold 11px ${FONT_FAMILY}`;
  ctx.fillStyle = '#34D399';
  ctx.fillText('⏰ COMPLETED HUNTBOTS', startX + 16, hbY + 24);
  ctx.font = `bold 18px ${FONT_FAMILY}`;
  ctx.fillStyle = '#FFFFFF';
  ctx.fillText(`${(stats.completedHuntbots || 0).toLocaleString()} runs finished`, startX + 16, hbY + 46);

  // Total HuntBot Time
  const hb2X = startX + hbW + hbGap;
  drawRoundedRect(ctx, hb2X, hbY, hbW, hbH, 12, 'rgba(59, 130, 246, 0.08)', 'rgba(59, 130, 246, 0.25)', 1);
  ctx.font = `bold 11px ${FONT_FAMILY}`;
  ctx.fillStyle = '#60A5FA';
  ctx.fillText('⏳ TOTAL HUNTBOT TIME SPENT', hb2X + 16, hbY + 24);
  ctx.font = `bold 18px ${FONT_FAMILY}`;
  ctx.fillStyle = '#FFFFFF';
  ctx.fillText(formatDuration(stats.totalHuntbotTime || 0), hb2X + 16, hbY + 46);

  // 7. Daily Activity Section (Bottom Panel)
  const dailyY = 326;
  const dailyW = width - 80;
  const dailyH = 156;
  drawRoundedRect(ctx, startX, dailyY, dailyW, dailyH, 16, 'rgba(255, 255, 255, 0.025)', 'rgba(255, 255, 255, 0.07)', 1);

  // Section Header
  ctx.font = `bold 12.5px ${FONT_FAMILY}`;
  ctx.fillStyle = '#C4B5FD';
  ctx.fillText('📅 TODAY\'S ACTIVITY OVERVIEW', startX + 20, dailyY + 28);

  ctx.font = `500 11px ${FONT_FAMILY}`;
  ctx.fillStyle = '#64748B';
  const resetNote = 'Resets automatically every day at 00:00 UTC';
  ctx.fillText(resetNote, startX + dailyW - ctx.measureText(resetNote).width - 20, dailyY + 28);

  // 4 Daily Mini Cards
  const subCardW = 188;
  const subCardH = 80;
  const subGap = 16;
  const subY = dailyY + 44;

  const dailyItems = [
    { label: 'DAILY OWO', val: (stats.dailyOwoCount || 0).toLocaleString(), icon: '💬', color: '#EC4899' },
    { label: 'DAILY HUNT', val: (stats.dailyHuntCount || 0).toLocaleString(), icon: '🏹', color: '#06B6D4' },
    { label: 'DAILY BATTLE', val: (stats.dailyBattleCount || 0).toLocaleString(), icon: '⚔️', color: '#F59E0B' },
    { label: 'DAILY PRAY', val: (stats.dailyPraycurseCount || 0).toLocaleString(), icon: '🙏', color: '#8B5CF6' },
  ];

  dailyItems.forEach((d, idx) => {
    const x = startX + 20 + idx * (subCardW + subGap);
    drawRoundedRect(ctx, x, subY, subCardW, subCardH, 10, 'rgba(255, 255, 255, 0.03)', 'rgba(255, 255, 255, 0.05)', 1);

    ctx.font = `bold 10px ${FONT_FAMILY}`;
    ctx.fillStyle = d.color;
    ctx.fillText(`${d.icon} ${d.label}`, x + 12, subY + 24);

    ctx.font = `bold 20px ${FONT_FAMILY}`;
    ctx.fillStyle = '#FFFFFF';
    ctx.fillText(d.val, x + 12, subY + 56);
  });

  // Footer text
  ctx.font = `500 10.5px ${FONT_FAMILY}`;
  ctx.fillStyle = '#475569';
  ctx.fillText('Ira Music • Atlantis Gaming System', startX + 4, height - 22);

  return canvas.toBuffer('image/png');
};

/**
 * Generate high-definition Server-Scoped OwO Stats Canvas Card
 * @param {Object} options
 * @param {import('discord.js').User} options.user
 * @param {import('discord.js').Guild} options.guild
 * @param {Object} options.guildStats
 * @returns {Promise<Buffer>} PNG Buffer
 */
const generateServerOwoStatsCard = async ({ user, guild, guildStats = {} }) => {
  const width = 900;
  const height = 540;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');

  // 1. Base Gradient Background (Server Theme: Royal Violet & Blue)
  const bgGrad = ctx.createLinearGradient(0, 0, width, height);
  bgGrad.addColorStop(0, '#0a0d1f');
  bgGrad.addColorStop(0.5, '#131838');
  bgGrad.addColorStop(1, '#080a18');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, width, height);

  // 2. Ambient Radiant Glows
  ctx.save();
  const radGlow1 = ctx.createRadialGradient(160, 120, 10, 160, 120, 260);
  radGlow1.addColorStop(0, 'rgba(59, 130, 246, 0.22)');
  radGlow1.addColorStop(1, 'rgba(59, 130, 246, 0)');
  ctx.fillStyle = radGlow1;
  ctx.fillRect(0, 0, width, height);

  const radGlow2 = ctx.createRadialGradient(760, 420, 10, 760, 420, 240);
  radGlow2.addColorStop(0, 'rgba(139, 92, 246, 0.18)');
  radGlow2.addColorStop(1, 'rgba(139, 92, 246, 0)');
  ctx.fillStyle = radGlow2;
  ctx.fillRect(0, 0, width, height);
  ctx.restore();

  // 3. Card Outer Frame Border
  drawRoundedRect(ctx, 16, 16, width - 32, height - 32, 22, 'rgba(20, 24, 48, 0.4)', 'rgba(255, 255, 255, 0.08)', 1.5);

  // 4. Header: User Avatar + Guild Icon
  const avatarSize = 82;
  const avatarX = 40;
  const avatarY = 38;

  let avatarImg = null;
  let guildImg = null;
  try {
    const avatarUrl = user.displayAvatarURL ? user.displayAvatarURL({ extension: 'png', size: 256 }) : user.avatarURL;
    if (avatarUrl) avatarImg = await loadImage(avatarUrl);
  } catch (_) {}

  try {
    const guildIconUrl = guild?.iconURL ? guild.iconURL({ extension: 'png', size: 128 }) : null;
    if (guildIconUrl) guildImg = await loadImage(guildIconUrl);
  } catch (_) {}

  // User Avatar Glow Ring
  ctx.save();
  ctx.beginPath();
  ctx.arc(avatarX + avatarSize / 2, avatarY + avatarSize / 2, avatarSize / 2 + 3, 0, Math.PI * 2);
  ctx.strokeStyle = '#3B82F6';
  ctx.lineWidth = 3;
  ctx.shadowColor = '#3B82F6';
  ctx.shadowBlur = 14;
  ctx.stroke();
  ctx.restore();

  // User Avatar Clip
  ctx.save();
  ctx.beginPath();
  ctx.arc(avatarX + avatarSize / 2, avatarY + avatarSize / 2, avatarSize / 2, 0, Math.PI * 2);
  ctx.closePath();
  ctx.clip();
  if (avatarImg) {
    ctx.drawImage(avatarImg, avatarX, avatarY, avatarSize, avatarSize);
  } else {
    ctx.fillStyle = '#3B82F6';
    ctx.fillRect(avatarX, avatarY, avatarSize, avatarSize);
  }
  ctx.restore();

  // User Name & Guild Scoping
  const textX = avatarX + avatarSize + 18;
  const username = user.displayName || user.globalName || user.username || 'User';
  const guildName = guild?.name || 'Discord Server';

  ctx.font = `bold 24px ${FONT_FAMILY}`;
  ctx.fillStyle = '#FFFFFF';
  ctx.fillText(truncateText(ctx, username, 360), textX, avatarY + 28);

  ctx.font = `600 13px ${FONT_FAMILY}`;
  ctx.fillStyle = '#60A5FA';
  ctx.fillText(`🏰 In: ${truncateText(ctx, guildName, 320)}`, textX, avatarY + 50);

  // Server ID Chip
  drawRoundedRect(ctx, textX, avatarY + 58, 200, 22, 6, 'rgba(59, 130, 246, 0.15)', 'rgba(59, 130, 246, 0.35)', 1);
  ctx.font = `600 10.5px ${FONT_FAMILY}`;
  ctx.fillStyle = '#93C5FD';
  ctx.fillText(`Server ID: ${guild?.id || 'Unknown'}`, textX + 10, avatarY + 73);

  // Top-Right Header Badge: Server Scoped
  const badgeWidth = 260;
  const badgeX = width - 40 - badgeWidth;
  drawRoundedRect(ctx, badgeX, 38, badgeWidth, 68, 14, 'rgba(59, 130, 246, 0.12)', 'rgba(59, 130, 246, 0.35)', 1.2);

  // Mini guild icon inside badge if available
  if (guildImg) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(badgeX + 32, 72, 18, 0, Math.PI * 2);
    ctx.closePath();
    ctx.clip();
    ctx.drawImage(guildImg, badgeX + 14, 54, 36, 36);
    ctx.restore();

    ctx.font = `bold 12.5px ${FONT_FAMILY}`;
    ctx.fillStyle = '#93C5FD';
    ctx.fillText('🏰 SERVER OWO STATS', badgeX + 58, 62);
    ctx.font = `500 11px ${FONT_FAMILY}`;
    ctx.fillStyle = '#94A3B8';
    ctx.fillText(truncateText(ctx, guildName, 180), badgeX + 58, 82);
  } else {
    ctx.font = `bold 13px ${FONT_FAMILY}`;
    ctx.fillStyle = '#93C5FD';
    ctx.fillText('🏰 SERVER OWO STATS', badgeX + 16, 62);
    ctx.font = `500 11px ${FONT_FAMILY}`;
    ctx.fillStyle = '#94A3B8';
    ctx.fillText('Scoped To This Server', badgeX + 16, 82);
  }

  // 5. Four Primary Server Lifetime Stat Cards
  const cardY = 138;
  const cardH = 100;
  const cardW = 194;
  const cardGap = 16;
  const startX = 40;

  const serverCards = [
    { label: 'SERVER OWO & UWU', value: (guildStats.owoCount || 0).toLocaleString(), icon: '💬', color: '#EC4899' },
    { label: 'SERVER HUNTS', value: (guildStats.huntCount || 0).toLocaleString(), icon: '🏹', color: '#06B6D4' },
    { label: 'SERVER BATTLES', value: (guildStats.battleCount || 0).toLocaleString(), icon: '⚔️', color: '#F59E0B' },
    { label: 'SERVER PRAYS', value: (guildStats.praycurseCount || 0).toLocaleString(), icon: '🙏', color: '#8B5CF6' },
  ];

  serverCards.forEach((c, i) => {
    const x = startX + i * (cardW + cardGap);
    drawRoundedRect(ctx, x, cardY, cardW, cardH, 14, 'rgba(255, 255, 255, 0.035)', 'rgba(255, 255, 255, 0.08)', 1);

    ctx.save();
    ctx.beginPath();
    ctx.strokeStyle = c.color;
    ctx.lineWidth = 3;
    ctx.moveTo(x + 18, cardY);
    ctx.lineTo(x + cardW - 18, cardY);
    ctx.stroke();
    ctx.restore();

    ctx.font = `bold 10px ${FONT_FAMILY}`;
    ctx.fillStyle = '#94A3B8';
    ctx.fillText(`${c.icon} ${c.label}`, x + 14, cardY + 28);

    ctx.font = `bold 24px ${FONT_FAMILY}`;
    ctx.fillStyle = '#FFFFFF';
    ctx.fillText(truncateText(ctx, c.value, cardW - 28), x + 14, cardY + 68);
  });

  // 6. Server Summary Strip
  const infoY = 254;
  const infoW = width - 80;
  const infoH = 56;
  drawRoundedRect(ctx, startX, infoY, infoW, infoH, 12, 'rgba(59, 130, 246, 0.08)', 'rgba(59, 130, 246, 0.25)', 1);

  ctx.font = `bold 11px ${FONT_FAMILY}`;
  ctx.fillStyle = '#60A5FA';
  ctx.fillText('🌟 SERVER CONTRIBUTION SUMMARY', startX + 16, infoY + 24);

  const totalAct = (guildStats.owoCount || 0) + (guildStats.huntCount || 0) + (guildStats.battleCount || 0) + (guildStats.praycurseCount || 0);
  ctx.font = `bold 17px ${FONT_FAMILY}`;
  ctx.fillStyle = '#FFFFFF';
  ctx.fillText(`${totalAct.toLocaleString()} total game actions registered in this server`, startX + 16, infoY + 46);

  // 7. Daily Server Activity Section (Bottom Panel)
  const dailyY = 326;
  const dailyW = width - 80;
  const dailyH = 156;
  drawRoundedRect(ctx, startX, dailyY, dailyW, dailyH, 16, 'rgba(255, 255, 255, 0.025)', 'rgba(255, 255, 255, 0.07)', 1);

  ctx.font = `bold 12.5px ${FONT_FAMILY}`;
  ctx.fillStyle = '#93C5FD';
  ctx.fillText('📅 TODAY\'S SERVER DAILY STATS', startX + 20, dailyY + 28);

  ctx.font = `500 11px ${FONT_FAMILY}`;
  ctx.fillStyle = '#64748B';
  const resetNote = 'Resets automatically every day at 00:00 UTC';
  ctx.fillText(resetNote, startX + dailyW - ctx.measureText(resetNote).width - 20, dailyY + 28);

  const subCardW = 188;
  const subCardH = 80;
  const subGap = 16;
  const subY = dailyY + 44;

  const serverDailyItems = [
    { label: 'SERVER DAILY OWO', val: (guildStats.dailyOwoCount || 0).toLocaleString(), icon: '💬', color: '#EC4899' },
    { label: 'SERVER DAILY HUNT', val: (guildStats.dailyHuntCount || 0).toLocaleString(), icon: '🏹', color: '#06B6D4' },
    { label: 'SERVER DAILY BATTLE', val: (guildStats.dailyBattleCount || 0).toLocaleString(), icon: '⚔️', color: '#F59E0B' },
    { label: 'SERVER DAILY PRAY', val: (guildStats.dailyPraycurseCount || 0).toLocaleString(), icon: '🙏', color: '#8B5CF6' },
  ];

  serverDailyItems.forEach((d, idx) => {
    const x = startX + 20 + idx * (subCardW + subGap);
    drawRoundedRect(ctx, x, subY, subCardW, subCardH, 10, 'rgba(255, 255, 255, 0.03)', 'rgba(255, 255, 255, 0.05)', 1);

    ctx.font = `bold 10px ${FONT_FAMILY}`;
    ctx.fillStyle = d.color;
    ctx.fillText(`${d.icon} ${d.label}`, x + 12, subY + 24);

    ctx.font = `bold 20px ${FONT_FAMILY}`;
    ctx.fillStyle = '#FFFFFF';
    ctx.fillText(d.val, x + 12, subY + 56);
  });

  // Footer text
  ctx.font = `500 10.5px ${FONT_FAMILY}`;
  ctx.fillStyle = '#475569';
  ctx.fillText('Ira Music • Server OwO Engine', startX + 4, height - 22);

  return canvas.toBuffer('image/png');
};

module.exports = {
  generateGlobalOwoStatsCard,
  generateServerOwoStatsCard,
};
