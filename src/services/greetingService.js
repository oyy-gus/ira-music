'use strict';

const { EmbedBuilder } = require('discord.js');
const logger = require('../logger/logger');
const Guild = require('../database/models/Guild');
const { renderGreetingCard } = require('./renderers/GreetingCardRenderer');

// ─── Safe Placeholder Parser (No eval / new Function) ─────────────────────────
const PLACEHOLDERS = {
  '{user}': (member) => (member?.id ? `<@${member.id}>` : '@User'),
  '{username}': (member) => member?.user?.username || member?.displayName || 'User',
  '{displayName}': (member) => member?.displayName || member?.user?.username || 'User',
  '{server}': (member, guild) => guild?.name || 'Ira Community',
  '{memberCount}': (member, guild) => String(guild?.memberCount ?? 150),
  '{memberNumber}': (member, guild) => String(guild?.memberCount ?? 150),
  '{userId}': (member) => member?.id || '1234567890',
  '{avatar}': (member) =>
    member?.user?.displayAvatarURL?.({ extension: 'png', size: 256, forceStatic: true }) || '',
};

const resolvePlaceholders = (template, member, guild) => {
  if (!template || typeof template !== 'string') return '';
  let result = template;
  for (const [token, fn] of Object.entries(PLACEHOLDERS)) {
    if (result.includes(token)) {
      result = result.split(token).join(fn(member, guild));
    }
  }
  return result;
};

// ─── Channel Permissions Validator ──────────────────────────────────────────
const checkChannelPermissions = (channel, guild, mode = 'standalone', useCard = true) => {
  if (!channel || !guild) {
    return { ok: false, missing: ['Channel/Guild not found'] };
  }
  const me = guild.members?.me;
  if (!me) {
    return { ok: false, missing: ['Bot member not cached in Guild'] };
  }

  const perms = channel.permissionsFor(me);
  if (!perms) {
    return { ok: false, missing: ['Permissions unresolvable'] };
  }

  const required = [
    { flag: 'ViewChannel', name: 'View Channel' },
    { flag: 'SendMessages', name: 'Send Messages' },
  ];

  if (mode === 'embed') {
    required.push({ flag: 'EmbedLinks', name: 'Embed Links' });
    if (useCard) required.push({ flag: 'Attach Files', name: 'Attach Files', bit: 'AttachFiles' });
  } else if (mode === 'standalone' && useCard) {
    required.push({ flag: 'AttachFiles', name: 'Attach Files' });
  }

  const missing = [];
  for (const req of required) {
    const flagKey = req.bit || req.flag;
    if (!perms.has(flagKey)) {
      missing.push(req.name);
    }
  }

  return {
    ok: missing.length === 0,
    missing,
  };
};

// ─── Default Configurations for Single Base Design ────────────────────────────
const DEFAULT_EMBED_WELCOME = {
  enabled: true,
  title: 'Welcome to {server}! 🎉',
  description: 'Welcome {user} to **{server}**! We are glad to have you with us.',
  color: '#8B5CF6',
  authorName: '{displayName}',
  authorIcon: true,
  footerText: 'Member #{memberNumber} • {server}',
  footerIcon: true,
  showCanvasCard: true,
};

const DEFAULT_EMBED_LEAVE = {
  enabled: true,
  title: 'Goodbye from {server}',
  description: "Goodbye **{displayName}**, we'll miss you!",
  color: '#EF4444',
  authorName: '{displayName}',
  authorIcon: true,
  footerText: '{server}',
  footerIcon: true,
  showCanvasCard: true,
};

const DEFAULT_CARD_WELCOME = {
  enabled: true,
  background: {
    type: 'builtin',
    value: 'default',
    fit: 'cover',
    position: 'center',
    overlay: true,
    overlayColor: '#000000',
    overlayOpacity: 50,
    blur: 0,
  },
  colors: {
    primary: '#8B5CF6',
    secondary: '#3B82F6',
    text: '#FFFFFF',
    subtext: '#9CA3AF',
    accent: '#8B5CF6',
  },
  fonts: {
    heading: 'Sans-Serif',
    body: 'Sans-Serif',
  },
  typography: {
    headingSize: 28,
    headingWeight: 'bold',
    bodySize: 16,
    bodyWeight: 'normal',
    memberNumberSize: 14,
    letterSpacing: 0,
    lineHeight: 1.2,
    alignment: 'center',
  },
  avatar: {
    shape: 'circle',
    size: 100,
    border: true,
    borderWidth: 4,
    borderColor: '#8B5CF6',
    shadow: true,
    shadowIntensity: 15,
    frame: 'ira',
  },
  layout: {
    alignment: 'center',
    avatarX: 350,
    avatarY: 75,
    headingX: 350,
    headingY: 160,
    messageX: 350,
    messageY: 198,
    serverX: 350,
    serverY: 236,
    spacing: 10,
  },
  visibility: {
    avatar: true,
    heading: true,
    message: true,
    serverName: true,
    memberNumber: true,
    memberCount: true,
    serverIcon: false,
  },
};

const DEFAULT_CARD_LEAVE = {
  enabled: true,
  background: {
    type: 'builtin',
    value: 'midnight',
    fit: 'cover',
    position: 'center',
    overlay: true,
    overlayColor: '#000000',
    overlayOpacity: 50,
    blur: 0,
  },
  colors: {
    primary: '#EF4444',
    secondary: '#F97316',
    text: '#FFFFFF',
    subtext: '#9CA3AF',
    accent: '#EF4444',
  },
  fonts: {
    heading: 'Sans-Serif',
    body: 'Sans-Serif',
  },
  typography: {
    headingSize: 28,
    headingWeight: 'bold',
    bodySize: 16,
    bodyWeight: 'normal',
    memberNumberSize: 14,
    letterSpacing: 0,
    lineHeight: 1.2,
    alignment: 'center',
  },
  avatar: {
    shape: 'circle',
    size: 100,
    border: true,
    borderWidth: 4,
    borderColor: '#EF4444',
    shadow: true,
    shadowIntensity: 15,
    frame: 'ira',
  },
  layout: {
    alignment: 'center',
    avatarX: 350,
    avatarY: 75,
    headingX: 350,
    headingY: 160,
    messageX: 350,
    messageY: 198,
    serverX: 350,
    serverY: 236,
    spacing: 10,
  },
  visibility: {
    avatar: true,
    heading: true,
    message: true,
    serverName: true,
    memberNumber: false,
    memberCount: true,
    serverIcon: false,
  },
};

const getDefaultGreetingConfig = (type = 'welcome') => {
  if (type === 'leave') {
    return {
      enabled: false,
      mode: 'standalone',
      channelId: null,
      message: "Goodbye {user}, we'll miss you!",
      messageEnabled: true,
      disableMention: false,
      useCard: true,
      autoDeleteMs: 0,
      embedConfig: DEFAULT_EMBED_LEAVE,
      card: DEFAULT_CARD_LEAVE,
    };
  }
  return {
    enabled: false,
    mode: 'standalone',
    channelId: null,
    message: 'Welcome {user} to {server}! 🎉',
    messageEnabled: true,
    disableMention: false,
    useCard: true,
    autoDeleteMs: 0,
    dmEnabled: false,
    dmMessage: 'Welcome to {server}! 🎵',
    embedConfig: DEFAULT_EMBED_WELCOME,
    card: DEFAULT_CARD_WELCOME,
  };
};

// ─── Deep Merge / Normalizer for card & embed object ─────────────────────────
function normalizeCardConfig(type, inputCard = {}) {
  const baseDefault = type === 'leave' ? DEFAULT_CARD_LEAVE : DEFAULT_CARD_WELCOME;
  const merged = JSON.parse(JSON.stringify(baseDefault));

  if (!inputCard || typeof inputCard !== 'object') return merged;

  if (inputCard.textColor) merged.colors.text = inputCard.textColor;
  if (inputCard.accentColor) {
    merged.colors.accent = inputCard.accentColor;
    merged.colors.primary = inputCard.accentColor;
    merged.avatar.borderColor = inputCard.accentColor;
  }
  if (inputCard.avatarStyle) merged.avatar.shape = inputCard.avatarStyle;
  if (inputCard.frame) merged.avatar.frame = inputCard.frame;
  if (typeof inputCard.showMemberCount === 'boolean') merged.visibility.memberCount = inputCard.showMemberCount;
  if (typeof inputCard.showMemberNumber === 'boolean') merged.visibility.memberNumber = inputCard.showMemberNumber;
  if (typeof inputCard.showServerIcon === 'boolean') merged.visibility.serverIcon = inputCard.showServerIcon;

  if (inputCard.background) Object.assign(merged.background, inputCard.background);
  if (inputCard.colors) Object.assign(merged.colors, inputCard.colors);
  if (inputCard.fonts) Object.assign(merged.fonts, inputCard.fonts);
  if (inputCard.typography) Object.assign(merged.typography, inputCard.typography);
  if (inputCard.avatar) Object.assign(merged.avatar, inputCard.avatar);
  if (inputCard.layout) Object.assign(merged.layout, inputCard.layout);
  if (inputCard.visibility) Object.assign(merged.visibility, inputCard.visibility);

  return merged;
}

function normalizeEmbedConfig(type, inputEmbed = {}) {
  const baseDefault = type === 'leave' ? DEFAULT_EMBED_LEAVE : DEFAULT_EMBED_WELCOME;
  return { ...baseDefault, ...(inputEmbed || {}) };
}

// ─── Card Renderer Wrapper ───────────────────────────────────────────────────
const renderCard = async (options = {}) => {
  const cardConfig = normalizeCardConfig(options.type || 'welcome', options.cardConfig || {});
  return renderGreetingCard({
    ...options,
    cardConfig,
  });
};

// ─── Greeting Config Service Methods ─────────────────────────────────────────
const getGreetingConfig = async (guildId) => {
  try {
    const doc = await Guild.findOne({ guildId }, { greeting: 1 }).lean();
    return doc?.greeting || null;
  } catch (err) {
    logger.error('[Greeting] Failed to load config', { guildId, error: err.message });
    return null;
  }
};

const updateGreetingConfig = async (guildId, type, data) => {
  if (type !== 'welcome' && type !== 'leave') throw new Error('Invalid greeting type');

  const update = {};
  for (const [k, v] of Object.entries(data)) {
    if (k === 'card' && typeof v === 'object') {
      const existingCfg = (await getGreetingConfig(guildId))?.[type]?.card || {};
      const normalized = normalizeCardConfig(type, { ...existingCfg, ...v });
      for (const [subK, subV] of Object.entries(normalized)) {
        update[`greeting.${type}.card.${subK}`] = subV;
      }
    } else if (k === 'embedConfig' && typeof v === 'object') {
      const existingEmbed = (await getGreetingConfig(guildId))?.[type]?.embedConfig || {};
      const normalized = normalizeEmbedConfig(type, { ...existingEmbed, ...v });
      for (const [subK, subV] of Object.entries(normalized)) {
        update[`greeting.${type}.embedConfig.${subK}`] = subV;
      }
    } else {
      update[`greeting.${type}.${k}`] = v;
    }
  }

  return Guild.findOneAndUpdate({ guildId }, { $set: update }, { new: true, upsert: true }).lean();
};

const resetGreetingConfig = async (guildId, type) => {
  if (type !== 'welcome' && type !== 'leave') throw new Error('Invalid greeting type');
  const defaults = getDefaultGreetingConfig(type);
  return Guild.findOneAndUpdate(
    { guildId },
    { $set: { [`greeting.${type}`]: defaults } },
    { new: true, upsert: true }
  ).lean();
};

const resetAppearance = async (guildId, type) => {
  if (type !== 'welcome' && type !== 'leave') throw new Error('Invalid greeting type');
  const defaultCard = type === 'leave' ? DEFAULT_CARD_LEAVE : DEFAULT_CARD_WELCOME;
  const defaultEmbed = type === 'leave' ? DEFAULT_EMBED_LEAVE : DEFAULT_EMBED_WELCOME;
  return Guild.findOneAndUpdate(
    { guildId },
    { $set: { [`greeting.${type}.card`]: defaultCard, [`greeting.${type}.embedConfig`]: defaultEmbed } },
    { new: true, upsert: true }
  ).lean();
};

// ─── Send Welcome Event Handler ──────────────────────────────────────────────
const sendWelcome = async (member) => {
  const guild = member?.guild;
  if (!guild) return;
  try {
    const cfg = await getGreetingConfig(guild.id);
    if (!cfg?.welcome?.enabled) return;
    const wCfg = cfg.welcome;
    const channel = wCfg.channelId ? guild.channels.cache.get(wCfg.channelId) : null;
    if (!channel) return;

    const mode = wCfg.mode || 'standalone';
    const useCard = wCfg.useCard !== false;

    // Check permissions
    const permCheck = checkChannelPermissions(channel, guild, mode, useCard);
    if (!permCheck.ok) {
      logger.warn('[Welcome] Missing permissions to send message', {
        guildId: guild.id,
        channelId: channel.id,
        missing: permCheck.missing.join(', '),
      });
      return;
    }

    const displayName = member.displayName || member.user?.username || 'User';
    const username = member.user?.username || 'user';
    const avatarUrl = member.user?.displayAvatarURL({ extension: 'png', size: 256, forceStatic: true }) || null;
    const memberCount = guild.memberCount || 0;
    
    const messageEnabled = wCfg.messageEnabled !== false;
    const disableMention = wCfg.disableMention === true;
    const allowedMentions = disableMention ? { parse: [] } : undefined;
    const msgText = messageEnabled && wCfg.message ? resolvePlaceholders(wCfg.message, member, guild) : '';

    let payload = { content: msgText || undefined, allowedMentions };

    if (mode === 'text') {
      payload = { content: msgText || 'Welcome!', allowedMentions };
    } else if (mode === 'embed') {
      const embedCfg = normalizeEmbedConfig('welcome', wCfg.embedConfig || {});
      const embed = new EmbedBuilder();

      if (embedCfg.title) embed.setTitle(resolvePlaceholders(embedCfg.title, member, guild));
      if (embedCfg.description) embed.setDescription(resolvePlaceholders(embedCfg.description, member, guild));
      if (embedCfg.color) {
        const hex = parseInt(embedCfg.color.replace('#', ''), 16);
        if (!isNaN(hex)) embed.setColor(hex);
      }

      if (embedCfg.authorName) {
        embed.setAuthor({
          name: resolvePlaceholders(embedCfg.authorName, member, guild),
          iconURL: embedCfg.authorIcon ? avatarUrl : undefined,
        });
      }

      if (embedCfg.footerText) {
        embed.setFooter({
          text: resolvePlaceholders(embedCfg.footerText, member, guild),
          iconURL: embedCfg.footerIcon ? guild.iconURL({ extension: 'png' }) : undefined,
        });
      }

      if (embedCfg.showCanvasCard !== false && useCard) {
        const imgBuffer = await renderCard({
          type: 'welcome',
          displayName,
          username,
          avatarUrl,
          guildName: guild.name,
          guildIconUrl: guild.iconURL({ extension: 'png', size: 128 }),
          memberCount,
          memberNumber: memberCount,
          cardConfig: wCfg.card || {},
        }).catch(() => null);

        if (imgBuffer) {
          embed.setImage('attachment://welcome.png');
          payload = { content: msgText || undefined, embeds: [embed], files: [{ attachment: imgBuffer, name: 'welcome.png' }], allowedMentions };
        } else {
          payload = { content: msgText || undefined, embeds: [embed], allowedMentions };
        }
      } else {
        payload = { content: msgText || undefined, embeds: [embed], allowedMentions };
      }
    } else {
      // mode === 'standalone'
      let imgBuffer = null;
      if (useCard) {
        imgBuffer = await renderCard({
          type: 'welcome',
          displayName,
          username,
          avatarUrl,
          guildName: guild.name,
          guildIconUrl: guild.iconURL({ extension: 'png', size: 128 }),
          memberCount,
          memberNumber: memberCount,
          cardConfig: wCfg.card || {},
        }).catch(() => null);
      }

      payload = imgBuffer
        ? { content: msgText || undefined, files: [{ attachment: imgBuffer, name: 'welcome.png' }], allowedMentions }
        : { content: msgText || 'Welcome!', allowedMentions };
    }

    const sent = await channel.send(payload);
    if (wCfg.autoDeleteMs > 0 && sent) setTimeout(() => sent.delete().catch(() => {}), wCfg.autoDeleteMs);
    if (wCfg.dmEnabled && wCfg.dmMessage) member.send(resolvePlaceholders(wCfg.dmMessage, member, guild)).catch(() => {});

    logger.info('[Welcome] Sent', { guildId: guild.id, userId: member.id, channelId: channel.id });
  } catch (err) {
    logger.error('[Welcome] Failed', { guildId: guild.id, userId: member.id, error: err.message });
  }
};

// ─── Send Leave Event Handler ────────────────────────────────────────────────
const sendLeave = async (member) => {
  const guild = member?.guild;
  if (!guild) return;
  try {
    const cfg = await getGreetingConfig(guild.id);
    if (!cfg?.leave?.enabled) return;
    const lCfg = cfg.leave;
    const channel = lCfg.channelId ? guild.channels.cache.get(lCfg.channelId) : null;
    if (!channel) return;

    const mode = lCfg.mode || 'standalone';
    const useCard = lCfg.useCard !== false;

    // Check permissions
    const permCheck = checkChannelPermissions(channel, guild, mode, useCard);
    if (!permCheck.ok) {
      logger.warn('[Leave] Missing permissions to send message', {
        guildId: guild.id,
        channelId: channel.id,
        missing: permCheck.missing.join(', '),
      });
      return;
    }

    const displayName = member.displayName || member.user?.username || 'User';
    const username = member.user?.username || 'user';
    const avatarUrl = member.user?.displayAvatarURL({ extension: 'png', size: 256, forceStatic: true }) || null;
    const memberCount = guild.memberCount || 0;

    const messageEnabled = lCfg.messageEnabled !== false;
    const disableMention = lCfg.disableMention === true;
    const allowedMentions = disableMention ? { parse: [] } : undefined;
    const msgText = messageEnabled && lCfg.message ? resolvePlaceholders(lCfg.message, member, guild) : '';

    let payload = { content: msgText || undefined, allowedMentions };

    if (mode === 'text') {
      payload = { content: msgText || 'Goodbye!', allowedMentions };
    } else if (mode === 'embed') {
      const embedCfg = normalizeEmbedConfig('leave', lCfg.embedConfig || {});
      const embed = new EmbedBuilder();

      if (embedCfg.title) embed.setTitle(resolvePlaceholders(embedCfg.title, member, guild));
      if (embedCfg.description) embed.setDescription(resolvePlaceholders(embedCfg.description, member, guild));
      if (embedCfg.color) {
        const hex = parseInt(embedCfg.color.replace('#', ''), 16);
        if (!isNaN(hex)) embed.setColor(hex);
      }

      if (embedCfg.authorName) {
        embed.setAuthor({
          name: resolvePlaceholders(embedCfg.authorName, member, guild),
          iconURL: embedCfg.authorIcon ? avatarUrl : undefined,
        });
      }

      if (embedCfg.footerText) {
        embed.setFooter({
          text: resolvePlaceholders(embedCfg.footerText, member, guild),
          iconURL: embedCfg.footerIcon ? guild.iconURL({ extension: 'png' }) : undefined,
        });
      }

      if (embedCfg.showCanvasCard !== false && useCard) {
        const imgBuffer = await renderCard({
          type: 'leave',
          displayName,
          username,
          avatarUrl,
          guildName: guild.name,
          guildIconUrl: guild.iconURL({ extension: 'png', size: 128 }),
          memberCount,
          cardConfig: lCfg.card || {},
        }).catch(() => null);

        if (imgBuffer) {
          embed.setImage('attachment://goodbye.png');
          payload = { content: msgText || undefined, embeds: [embed], files: [{ attachment: imgBuffer, name: 'goodbye.png' }], allowedMentions };
        } else {
          payload = { content: msgText || undefined, embeds: [embed], allowedMentions };
        }
      } else {
        payload = { content: msgText || undefined, embeds: [embed], allowedMentions };
      }
    } else {
      // mode === 'standalone'
      let imgBuffer = null;
      if (useCard) {
        imgBuffer = await renderCard({
          type: 'leave',
          displayName,
          username,
          avatarUrl,
          guildName: guild.name,
          guildIconUrl: guild.iconURL({ extension: 'png', size: 128 }),
          memberCount,
          cardConfig: lCfg.card || {},
        }).catch(() => null);
      }

      payload = imgBuffer
        ? { content: msgText || undefined, files: [{ attachment: imgBuffer, name: 'goodbye.png' }], allowedMentions }
        : { content: msgText || 'Goodbye!', allowedMentions };
    }

    const sent = await channel.send(payload);
    if (lCfg.autoDeleteMs > 0 && sent) setTimeout(() => sent.delete().catch(() => {}), lCfg.autoDeleteMs);

    logger.info('[Leave] Sent', { guildId: guild.id, userId: member.id, channelId: channel.id });
  } catch (err) {
    logger.error('[Leave] Failed', { guildId: guild.id, userId: member.id, error: err.message });
  }
};

// ─── Live Preview Renderer (Safe, no Discord send) ───────────────────────────
const renderPreview = async (typeOrOptions, cardConfigInput = {}) => {
  let type = 'welcome';
  let cfg = {};
  let customMsg = '';
  let displayName = 'Ira Music';
  let username = 'iramusic';
  let avatarUrl = null;

  if (typeOrOptions && typeof typeOrOptions === 'object') {
    type = typeOrOptions.mode || typeOrOptions.type || 'welcome';
    cfg = typeOrOptions.cardConfig || typeOrOptions.config || typeOrOptions.card || {};
    customMsg = typeOrOptions.message || typeOrOptions.customMessageText || '';
    if (typeOrOptions.displayName) displayName = typeOrOptions.displayName;
    if (typeOrOptions.username) username = typeOrOptions.username;
    if (typeOrOptions.avatarUrl) avatarUrl = typeOrOptions.avatarUrl;
  } else {
    type = typeOrOptions || 'welcome';
    cfg = cardConfigInput;
  }

  const dummyUser = { displayName, id: '999888777', user: { username, displayAvatarURL: () => avatarUrl } };
  const dummyGuild = { name: 'Ira Community', memberCount: 250 };
  const previewMsg = customMsg
    ? resolvePlaceholders(customMsg, dummyUser, dummyGuild)
    : type === 'welcome'
    ? `Welcome ${displayName} to Ira Community! 🎉`
    : `Goodbye ${displayName}, we'll miss you!`;

  const buffer = await renderCard({
    type,
    displayName,
    username,
    avatarUrl,
    guildName: 'Ira Community',
    memberCount: type === 'welcome' ? 250 : 249,
    memberNumber: 152,
    cardConfig: cfg,
    customMessageText: previewMsg,
  });

  if (!buffer) return null;
  return `data:image/png;base64,${buffer.toString('base64')}`;
};

module.exports = {
  resolvePlaceholders,
  checkChannelPermissions,
  renderCard,
  renderPreview,
  getGreetingConfig,
  updateGreetingConfig,
  resetGreetingConfig,
  resetAppearance,
  sendWelcome,
  sendLeave,
  DEFAULT_CARD_WELCOME,
  DEFAULT_CARD_LEAVE,
  DEFAULT_EMBED_WELCOME,
  DEFAULT_EMBED_LEAVE,
  normalizeCardConfig,
  normalizeEmbedConfig,
};
