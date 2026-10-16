const {
  EmbedBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  MessageFlags,
} = require('discord.js');
const userRepo = require('../../database/repositories/userRepository');
const {
  COSMETICS_REGISTRY,
  COSMETIC_TYPES,
  getCosmeticById,
  getUnlockedCosmeticsForLevel,
  DEFAULT_EQUIPPED_COSMETICS,
} = require('../../config/cosmetics');
const { calculateProgression } = require('../../services/xpService');
const { getEmoji } = require('../../config/emojis');

const CATEGORIES = {
  overview:    { key: 'overview',    emojiKey: 'overview',    label: 'Overview',     emoji: '🏠',  typeName: null },
  frame:       { key: 'frame',       emojiKey: 'frame',       label: 'Frames',       emoji: '🖼️',  typeName: COSMETIC_TYPES.FRAME },
  background:  { key: 'background',  emojiKey: 'background',  label: 'Backgrounds',  emoji: '🎨',  typeName: COSMETIC_TYPES.BACKGROUND },
  glow:        { key: 'glow',        emojiKey: 'glow',        label: 'Glows',        emoji: '✨',  typeName: COSMETIC_TYPES.GLOW },
  decoration:  { key: 'decoration',  emojiKey: 'decoration',  label: 'Decorations',  emoji: '🎵',  typeName: COSMETIC_TYPES.DECORATION },
  avatarEffect:{ key: 'avatarEffect',emojiKey: 'avatarfx',   label: 'Avatar FX',    emoji: '⭕',  typeName: COSMETIC_TYPES.AVATAR_EFFECT },
  nameEffect:  { key: 'nameEffect',  emojiKey: 'namefx',     label: 'Name FX',      emoji: '🔤',  typeName: COSMETIC_TYPES.NAME_EFFECT },
  levelEmblem: { key: 'levelEmblem', emojiKey: 'emblem',     label: 'Emblems',      emoji: '⭐',  typeName: COSMETIC_TYPES.LEVEL_EMBLEM },
  visualizer:  { key: 'visualizer',  emojiKey: 'visualizer', label: 'Visualizers',  emoji: '📊',  typeName: COSMETIC_TYPES.VISUALIZER },
  title:       { key: 'title',       emojiKey: 'title',      label: 'Titles',       emoji: '🏷️', typeName: COSMETIC_TYPES.TITLE },
};

const PAGE_ORDER = [
  'overview', 'frame', 'background', 'glow', 'decoration',
  'avatarEffect', 'nameEffect', 'levelEmblem', 'visualizer', 'title',
];

/**
 * Returns emoji string for embed text. Falls back to unicode if custom emoji not set.
 */
const e = (key, fallback = '', client = null) => {
  const custom = getEmoji(key, client);
  if (custom && custom.trim() !== '') return custom;
  return fallback;
};

/**
 * Returns emoji for use in Discord component options (select menus).
 * Returns {name, id} object for custom emojis, or unicode string as fallback.
 */
const eOpt = (key, fallback = '', client = null) => {
  const customStr = getEmoji(key, client);
  if (customStr && customStr.startsWith('<:')) {
    const inner = customStr.slice(2, -1).split(':');
    if (inner.length === 2 && inner[1]) return { name: inner[0], id: inner[1] };
  }
  return fallback || undefined;
};

/**
 * Returns emoji string for a category key. Falls back to category.emoji unicode.
 */
const catE = (cat, client = null) => {
  const custom = getEmoji(cat.emojiKey, client);
  if (custom && custom.trim() !== '') return `${custom} `;
  return `${cat.emoji} `;
};

/**
 * Returns component-safe emoji for a category (for dropdown options).
 */
const catEOpt = (cat, client = null) => eOpt(cat.emojiKey, cat.emoji, client);

const getCategoryFromArg = (arg) => {
  if (!arg) return null;
  const clean = arg.toLowerCase();
  if (['overview', 'all', 'info', 'equipped', 'summary'].includes(clean)) return 'overview';
  if (['frame', 'frames'].includes(clean)) return 'frame';
  if (['background', 'backgrounds', 'bg'].includes(clean)) return 'background';
  if (['glow', 'glows'].includes(clean)) return 'glow';
  if (['decoration', 'decorations', 'deco'].includes(clean)) return 'decoration';
  if (['avatareffect', 'avatar', 'avatarfx', 'avatar_effect'].includes(clean)) return 'avatarEffect';
  if (['nameeffect', 'name', 'namefx', 'name_effect'].includes(clean)) return 'nameEffect';
  if (['levelemblem', 'emblem', 'emblems', 'level_emblem'].includes(clean)) return 'levelEmblem';
  if (['visualizer', 'visualizers', 'vis'].includes(clean)) return 'visualizer';
  if (['title', 'titles'].includes(clean)) return 'title';
  return null;
};

const buildCosmeticsPageView = (pageIndex, equipped, unlockedSet, prog, userId, client = null) => {
  const activeKey = PAGE_ORDER[pageIndex] || 'overview';
  const isOverview = activeKey === 'overview';

  // ── Shared emoji references ──────────────────────────────────────────────
  const iCosm    = e('cosmetics', '🎨', client);
  const iProfile = e('profile',   '👤', client);
  const iCrown   = e('crown',     '👑', client);
  const iUnlock  = e('unlock',    '🔓', client);
  const iLock    = e('lock',      '🔒', client);
  const iSuccess = e('success',   '✅', client);
  const iStar    = e('analyzing', '⭐', client);
  const iInfo    = e('info',      'ℹ️',  client);
  const iError   = e('error',     '❌', client);

  // ── Row 1: Select Category Dropdown ─────────────────────────────────────
  const categoryJumpOptions = PAGE_ORDER.map((key) => {
    const cat = CATEGORIES[key];
    return {
      label: cat.label,
      value: key,
      description: key === 'overview'
        ? 'View equipped items & progression summary'
        : `Browse ${cat.label}`,
      emoji: catEOpt(cat, client),
      default: key === activeKey,
    };
  });

  const categoryRow = new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId('cosm_cat_jump')
      .setPlaceholder('Select Category...')
      .addOptions(categoryJumpOptions)
  );

  const components = [categoryRow];
  let embed;

  // ── OVERVIEW page ────────────────────────────────────────────────────────
  if (isOverview) {
    embed = new EmbedBuilder()
      .setTitle(`${iCosm} PROFILE COSMETICS & EQUIPMENT`)
      .setDescription(
        `${iInfo} Select a category from the dropdown menu below to browse cosmetics.\n` +
        `Or type \`*equip <cosmetic_id>\` to equip directly.\n\n` +
        `${iProfile} **User:** <@${userId}>\n` +
        `${iStar} **Level:** **${prog.level}** | **XP:** ${prog.currentXP} / ${prog.requiredXP}\n` +
        `${iUnlock} **Total Unlocked:** **${unlockedSet.size}** / **${COSMETICS_REGISTRY.length}**`
      )
      .setColor(0x5865F2)
      .setFooter({ text: 'Select a category below to browse items' });

    // Equipped cosmetics field
    const equippedLines = PAGE_ORDER.filter((k) => k !== 'overview').map((k) => {
      const cat = CATEGORIES[k];
      const equippedId = equipped[cat.typeName];
      const item = getCosmeticById(equippedId);
      return `${catE(cat, client)}**${cat.label}:** ${item ? `${item.name} (\`${item.id}\`)` : '*None*'}`;
    });

    embed.addFields({
      name: `${iCrown} EQUIPPED COSMETICS`,
      value: equippedLines.join('\n'),
      inline: false,
    });

    // Unlocked by category breakdown
    const categoryBreakdowns = PAGE_ORDER.filter((k) => k !== 'overview').map((k) => {
      const cat = CATEGORIES[k];
      const catItems = COSMETICS_REGISTRY.filter((c) => c.type === cat.typeName);
      const unlockedCount = catItems.filter((c) => unlockedSet.has(c.id)).length;
      return `${catE(cat, client)}**${cat.label}:** \`${unlockedCount}/${catItems.length}\` unlocked`;
    });

    embed.addFields({
      name: `${iInfo} UNLOCKED BY CATEGORY`,
      value: categoryBreakdowns.join('\n'),
      inline: false,
    });

  // ── CATEGORY page ────────────────────────────────────────────────────────
  } else {
    const catConfig = CATEGORIES[activeKey];
    const catItems = COSMETICS_REGISTRY.filter((c) => c.type === catConfig.typeName);
    const unlockedCatItems = catItems.filter((c) => unlockedSet.has(c.id));

    embed = new EmbedBuilder()
      .setTitle(`${iCosm} COSMETICS — ${catE(catConfig, client)}${catConfig.label.toUpperCase()}`)
      .setDescription(
        `${iInfo} Equip unlocked items with the dropdown below or type \`*equip <cosmetic_id>\`.\n` +
        `${iStar} **Level:** **${prog.level}** | ${iUnlock} **Unlocked:** **${unlockedCatItems.length}/${catItems.length}**`
      )
      .setColor(0x5865F2)
      .setFooter({
        text: `Category: ${catConfig.label} (${unlockedCatItems.length}/${catItems.length} unlocked)`,
      });

    const unlockedLines = [];
    const lockedLines = [];

    for (const item of catItems) {
      const isEquipped = equipped[catConfig.typeName] === item.id;
      const isUnlocked = unlockedSet.has(item.id);

      let statusEmoji, statusBadge;
      if (isEquipped) {
        statusEmoji = iSuccess;
        statusBadge = `${iSuccess} **[EQUIPPED]**`;
      } else if (isUnlocked) {
        statusEmoji = iUnlock;
        statusBadge = `${iUnlock} **UNLOCKED**`;
      } else {
        statusEmoji = iLock;
        statusBadge = `${iLock} **LOCKED**`;
      }

      const details = [item.rarity, isUnlocked ? `Lv. ${item.unlockLevel}` : `Req. Lv. ${item.unlockLevel}`];
      if (item.symbol) details.push(item.symbol);
      if (item.icon)   details.push(item.icon);
      if (item.style)  details.push(`\`${item.style}\``);

      const line = `${statusEmoji} **${item.name}** (\`${item.id}\`) — ${statusBadge} · ${details.join(' · ')}`;

      if (isUnlocked || isEquipped) {
        unlockedLines.push(line);
      } else {
        lockedLines.push(line);
      }
    }

    if (unlockedLines.length > 0) {
      embed.addFields({
        name: `${iUnlock} UNLOCKED (${unlockedLines.length})`,
        value: unlockedLines.join('\n').slice(0, 1024),
        inline: false,
      });
    }

    if (lockedLines.length > 0) {
      embed.addFields({
        name: `${iLock} LOCKED (${lockedLines.length})`,
        value: lockedLines.join('\n').slice(0, 1024),
        inline: false,
      });
    }

    if (unlockedLines.length === 0 && lockedLines.length === 0) {
      embed.addFields({
        name: `${catE(catConfig, client)}${catConfig.label.toUpperCase()}`,
        value: `${iError} No items found in this category.`,
        inline: false,
      });
    }

    // ── Row 2: Equip item dropdown (unlocked items only) ──────────────────
    if (unlockedCatItems.length > 0) {
      const options = unlockedCatItems.map((item) => {
        const isEquipped = equipped[catConfig.typeName] === item.id;
        return {
          label: item.name.length > 25 ? item.name.slice(0, 22) + '...' : item.name,
          value: item.id,
          description: `Level ${item.unlockLevel} · ${item.rarity}`.slice(0, 50),
          emoji: isEquipped ? eOpt('success', '✅', client) : eOpt('unlock', '🔓', client),
          default: isEquipped,
        };
      });

      components.push(
        new ActionRowBuilder().addComponents(
          new StringSelectMenuBuilder()
            .setCustomId('cosm_equip_select')
            .setPlaceholder(`Equip a ${catConfig.label.replace(/s$/, '')}...`)
            .addOptions(options)
        )
      );
    }
  }

  return { embed, components };
};

module.exports = {
  name: 'cosmetics',
  description: 'View profile cosmetics per category and equip frames, backgrounds, titles & decorations',
  aliases: ['equip', 'cosmetic', 'customization'],
  category: 'utility',
  cooldown: 5,
  async execute({ message, args, client }) {
    const userId = message.author.id;
    const userDoc = await userRepo.getUser(userId);

    const prog = calculateProgression(userDoc?.xp || 0);
    const unlockedList = getUnlockedCosmeticsForLevel(prog.level);
    const unlockedSet = new Set([...(userDoc?.unlockedCosmetics || []), ...unlockedList]);
    let equipped = { ...DEFAULT_EQUIPPED_COSMETICS, ...(userDoc?.equippedCosmetics || {}) };

    const iSuccess = getEmoji('success', client) || '✅';
    const iError   = getEmoji('error',   client) || '❌';

    let pageIndex = 0;

    if (args.length > 0) {
      const argInput = args[0].toLowerCase();

      // Direct equip by ID
      const targetItem = getCosmeticById(argInput);
      if (targetItem) {
        try {
          await userRepo.equipCosmetic(userId, targetItem.id);
          return message.reply(`${iSuccess} Successfully equipped **${targetItem.name}** (\`${targetItem.type}\`)!`);
        } catch (err) {
          return message.reply(`${iError} ${err.message}`);
        }
      }

      // Open by category name
      const catMatch = getCategoryFromArg(argInput);
      if (catMatch) {
        const matchedIdx = PAGE_ORDER.indexOf(catMatch);
        if (matchedIdx !== -1) pageIndex = matchedIdx;
      } else {
        return message.reply(
          `${iError} Unknown cosmetic ID or category \`${argInput}\`.\nUse \`*cosmetics\` to view available items.`
        );
      }
    }

    const initialView = buildCosmeticsPageView(pageIndex, equipped, unlockedSet, prog, userId, client);
    const replyMsg = await message.reply({
      embeds: [initialView.embed],
      components: initialView.components,
    });

    const collector = replyMsg.createMessageComponentCollector({ time: 120000 });

    collector.on('collect', async (interaction) => {
      if (interaction.user.id !== userId) {
        return interaction.reply({
          content: `${iError} Only <@${userId}> can use this menu. Run \`*cosmetics\` to open your own!`,
          flags: MessageFlags.Ephemeral,
        });
      }

      try {
        if (interaction.customId === 'cosm_cat_jump') {
          const selectedCategory = interaction.values[0];
          const matchedIdx = PAGE_ORDER.indexOf(selectedCategory);
          if (matchedIdx !== -1) pageIndex = matchedIdx;

        } else if (interaction.customId === 'cosm_equip_select') {
          const selectedId = interaction.values[0];
          const item = getCosmeticById(selectedId);
          if (item) {
            await userRepo.equipCosmetic(userId, selectedId);
            equipped[item.type] = selectedId;
          }
        }

        const updatedView = buildCosmeticsPageView(pageIndex, equipped, unlockedSet, prog, userId, client);
        await interaction.update({
          embeds: [updatedView.embed],
          components: updatedView.components,
        });
      } catch (err) {
        if (!interaction.replied && !interaction.deferred) {
          await interaction.reply({
            content: `${iError} Error: ${err.message}`,
            flags: MessageFlags.Ephemeral,
          }).catch(() => {});
        }
      }
    });

    collector.on('end', () => {
      replyMsg.edit({ components: [] }).catch(() => {});
    });
  },
};
