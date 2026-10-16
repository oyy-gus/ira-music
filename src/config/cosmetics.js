/**
 * Ira Music Cosmetic Registry
 * Defines all cosmetics for user profile cards.
 * Visual only — strictly no playback advantages.
 */

const RARITY = {
  COMMON: 'Common',
  RARE: 'Rare',
  EPIC: 'Epic',
  LEGENDARY: 'Legendary',
  MYTHIC: 'Mythic',
  ETERNAL: 'Eternal',
};

const COSMETIC_TYPES = {
  FRAME: 'frame',
  BACKGROUND: 'background',
  GLOW: 'glow',
  DECORATION: 'decoration',
  AVATAR_EFFECT: 'avatarEffect',
  NAME_EFFECT: 'nameEffect',
  LEVEL_EMBLEM: 'levelEmblem',
  VISUALIZER: 'visualizer',
  TITLE: 'title',
};

const COSMETICS_REGISTRY = [
  // ==================== FRAMES ====================
  { id: 'frame_basic', name: 'Basic Frame', type: COSMETIC_TYPES.FRAME, rarity: RARITY.COMMON, unlockLevel: 1, color: '#949BA4' },
  { id: 'frame_silver', name: 'Silver Frame', type: COSMETIC_TYPES.FRAME, rarity: RARITY.RARE, unlockLevel: 25, color: '#C0C0C0' },
  { id: 'frame_gold', name: 'Golden Frame', type: COSMETIC_TYPES.FRAME, rarity: RARITY.EPIC, unlockLevel: 100, color: '#FEE75C' },
  { id: 'frame_diamond', name: 'Diamond Frame', type: COSMETIC_TYPES.FRAME, rarity: RARITY.LEGENDARY, unlockLevel: 250, color: '#57F287' },
  { id: 'frame_flame', name: 'Flame Frame', type: COSMETIC_TYPES.FRAME, rarity: RARITY.LEGENDARY, unlockLevel: 500, color: '#ED4245' },
  { id: 'frame_mythic', name: 'Mythic Frame', type: COSMETIC_TYPES.FRAME, rarity: RARITY.MYTHIC, unlockLevel: 750, color: '#EB459E' },
  { id: 'frame_eternal', name: 'Eternal Frame', type: COSMETIC_TYPES.FRAME, rarity: RARITY.ETERNAL, unlockLevel: 1000, color: '#FFD700' },

  // ==================== BACKGROUNDS ====================
  { id: 'bg_dark', name: 'Midnight Dark', type: COSMETIC_TYPES.BACKGROUND, rarity: RARITY.COMMON, unlockLevel: 1, colors: ['#0d0e1b', '#13152c', '#0a0a14'] },
  { id: 'bg_neon', name: 'Neon Beat', type: COSMETIC_TYPES.BACKGROUND, rarity: RARITY.RARE, unlockLevel: 30, colors: ['#1a0933', '#2a0845', '#0f051d'] },
  { id: 'bg_aurora', name: 'Cosmic Aurora', type: COSMETIC_TYPES.BACKGROUND, rarity: RARITY.EPIC, unlockLevel: 150, colors: ['#031d2e', '#0b4f6c', '#011627'] },
  { id: 'bg_cyber', name: 'Cyberpunk Pulse', type: COSMETIC_TYPES.BACKGROUND, rarity: RARITY.LEGENDARY, unlockLevel: 400, colors: ['#20002c', '#cbb4d4', '#000000'] },
  { id: 'bg_eternal', name: 'Eternal Cosmos', type: COSMETIC_TYPES.BACKGROUND, rarity: RARITY.ETERNAL, unlockLevel: 1000, colors: ['#1f1c2c', '#928dab', '#100e19'] },

  // ==================== GLOWS ====================
  { id: 'glow_blue', name: 'Blue Glow', type: COSMETIC_TYPES.GLOW, rarity: RARITY.COMMON, unlockLevel: 1, color: 'rgba(88, 101, 242, 0.4)' },
  { id: 'glow_pink', name: 'Pink Synth Glow', type: COSMETIC_TYPES.GLOW, rarity: RARITY.RARE, unlockLevel: 40, color: 'rgba(235, 69, 158, 0.5)' },
  { id: 'glow_emerald', name: 'Emerald Wave', type: COSMETIC_TYPES.GLOW, rarity: RARITY.EPIC, unlockLevel: 200, color: 'rgba(87, 242, 135, 0.5)' },
  { id: 'glow_solar', name: 'Solar Energy', type: COSMETIC_TYPES.GLOW, rarity: RARITY.LEGENDARY, unlockLevel: 600, color: 'rgba(254, 231, 92, 0.6)' },
  { id: 'glow_eternal', name: 'Eternal Aura', type: COSMETIC_TYPES.GLOW, rarity: RARITY.ETERNAL, unlockLevel: 1000, color: 'rgba(255, 215, 0, 0.7)' },

  // ==================== DECORATIONS ====================
  { id: 'deco_notes', name: 'Floating Music Notes', type: COSMETIC_TYPES.DECORATION, rarity: RARITY.COMMON, unlockLevel: 10, symbol: '🎵' },
  { id: 'deco_stars', name: 'Star Field', type: COSMETIC_TYPES.DECORATION, rarity: RARITY.RARE, unlockLevel: 50, symbol: '✨' },
  { id: 'deco_vinyl', name: 'Vinyl Groove', type: COSMETIC_TYPES.DECORATION, rarity: RARITY.EPIC, unlockLevel: 175, symbol: '💿' },
  { id: 'deco_flame', name: 'Flame Particles', type: COSMETIC_TYPES.DECORATION, rarity: RARITY.LEGENDARY, unlockLevel: 450, symbol: '🔥' },
  { id: 'deco_eternal', name: 'Eternal Stars', type: COSMETIC_TYPES.DECORATION, rarity: RARITY.ETERNAL, unlockLevel: 1000, symbol: '🌌' },

  // ==================== AVATAR EFFECTS ====================
  { id: 'avatarfx_ring', name: 'Ring Animation', type: COSMETIC_TYPES.AVATAR_EFFECT, rarity: RARITY.COMMON, unlockLevel: 15, style: 'ring' },
  { id: 'avatarfx_wave', name: 'Music Wave Ring', type: COSMETIC_TYPES.AVATAR_EFFECT, rarity: RARITY.RARE, unlockLevel: 75, style: 'wave' },
  { id: 'avatarfx_equalizer', name: 'Equalizer Ring', type: COSMETIC_TYPES.AVATAR_EFFECT, rarity: RARITY.EPIC, unlockLevel: 300, style: 'equalizer' },
  { id: 'avatarfx_energy', name: 'Energy Pulse', type: COSMETIC_TYPES.AVATAR_EFFECT, rarity: RARITY.LEGENDARY, unlockLevel: 650, style: 'energy' },
  { id: 'avatarfx_eternal', name: 'Eternal Ring', type: COSMETIC_TYPES.AVATAR_EFFECT, rarity: RARITY.ETERNAL, unlockLevel: 1000, style: 'eternal' },

  // ==================== NAME EFFECTS ====================
  { id: 'namefx_shimmer', name: 'Shimmer Name', type: COSMETIC_TYPES.NAME_EFFECT, rarity: RARITY.RARE, unlockLevel: 60, style: 'shimmer' },
  { id: 'namefx_gradient', name: 'Gradient Name', type: COSMETIC_TYPES.NAME_EFFECT, rarity: RARITY.EPIC, unlockLevel: 220, style: 'gradient' },
  { id: 'namefx_electric', name: 'Electric Name', type: COSMETIC_TYPES.NAME_EFFECT, rarity: RARITY.LEGENDARY, unlockLevel: 550, style: 'electric' },

  // ==================== LEVEL EMBLEMS ====================
  { id: 'emblem_listener', name: 'Listener Emblem', type: COSMETIC_TYPES.LEVEL_EMBLEM, rarity: RARITY.COMMON, unlockLevel: 1, icon: '🎧', maxLvl: 24 },
  { id: 'emblem_fan', name: 'Fan Emblem', type: COSMETIC_TYPES.LEVEL_EMBLEM, rarity: RARITY.RARE, unlockLevel: 25, icon: '🎵', maxLvl: 49 },
  { id: 'emblem_elite', name: 'Elite Emblem', type: COSMETIC_TYPES.LEVEL_EMBLEM, rarity: RARITY.EPIC, unlockLevel: 50, icon: '⚡', maxLvl: 99 },
  { id: 'emblem_master', name: 'Master Emblem', type: COSMETIC_TYPES.LEVEL_EMBLEM, rarity: RARITY.EPIC, unlockLevel: 100, icon: '🌌', maxLvl: 249 },
  { id: 'emblem_veteran', name: 'Veteran Emblem', type: COSMETIC_TYPES.LEVEL_EMBLEM, rarity: RARITY.LEGENDARY, unlockLevel: 250, icon: '👑', maxLvl: 499 },
  { id: 'emblem_legendary', name: 'Legendary Emblem', type: COSMETIC_TYPES.LEVEL_EMBLEM, rarity: RARITY.MYTHIC, unlockLevel: 500, icon: '🏆', maxLvl: 999 },
  { id: 'emblem_eternal', name: 'Eternal Emblem', type: COSMETIC_TYPES.LEVEL_EMBLEM, rarity: RARITY.ETERNAL, unlockLevel: 1000, icon: '💎', maxLvl: 1000 },

  // ==================== VISUALIZERS ====================
  { id: 'vis_spectrum', name: 'Spectrum Waves', type: COSMETIC_TYPES.VISUALIZER, rarity: RARITY.COMMON, unlockLevel: 10, color: '#5865F2' },
  { id: 'vis_equalizer', name: 'Equalizer Bars', type: COSMETIC_TYPES.VISUALIZER, rarity: RARITY.RARE, unlockLevel: 80, color: '#57F287' },
  { id: 'vis_cyberwave', name: 'Cyber Waveform', type: COSMETIC_TYPES.VISUALIZER, rarity: RARITY.EPIC, unlockLevel: 350, color: '#EB459E' },
  { id: 'vis_eternal', name: 'Eternal Resonance', type: COSMETIC_TYPES.VISUALIZER, rarity: RARITY.ETERNAL, unlockLevel: 1000, color: '#FFD700' },

  // ==================== TITLES ====================
  { id: 'title_first', name: 'First Listener', type: COSMETIC_TYPES.TITLE, rarity: RARITY.COMMON, unlockLevel: 1 },
  { id: 'title_fan', name: 'Music Fan', type: COSMETIC_TYPES.TITLE, rarity: RARITY.COMMON, unlockLevel: 10 },
  { id: 'title_dedicated', name: 'Dedicated Listener', type: COSMETIC_TYPES.TITLE, rarity: RARITY.RARE, unlockLevel: 50 },
  { id: 'title_devoted', name: 'Devoted Listener', type: COSMETIC_TYPES.TITLE, rarity: RARITY.EPIC, unlockLevel: 100 },
  { id: 'title_veteran', name: 'Veteran Listener', type: COSMETIC_TYPES.TITLE, rarity: RARITY.LEGENDARY, unlockLevel: 250 },
  { id: 'title_legend', name: 'Ira Legend', type: COSMETIC_TYPES.TITLE, rarity: RARITY.MYTHIC, unlockLevel: 500 },
  { id: 'title_eternal', name: 'Eternal Listener', type: COSMETIC_TYPES.TITLE, rarity: RARITY.ETERNAL, unlockLevel: 1000 },
];

/**
 * Get cosmetic by ID
 */
const getCosmeticById = (id) => COSMETICS_REGISTRY.find((c) => c.id === id) || null;

/**
 * Get all cosmetics unlocked at or below a given level
 */
const getUnlockedCosmeticsForLevel = (level) => {
  return COSMETICS_REGISTRY.filter((c) => (c.unlockLevel || 1) <= level).map((c) => c.id);
};

/**
 * Default cosmetics setup for new user
 */
const DEFAULT_EQUIPPED_COSMETICS = {
  frame: 'frame_basic',       // Lv. 1
  background: 'bg_dark',      // Lv. 1
  glow: 'glow_blue',          // Lv. 1
  decoration: null,           // deco_notes requires Lv. 10 — don't equip by default
  avatarEffect: null,
  nameEffect: null,
  levelEmblem: 'emblem_listener', // Lv. 1
  visualizer: null,           // vis_spectrum requires Lv. 10 — don't equip by default
  title: 'title_first',       // Lv. 1
};

/**
 * Returns a sanitized copy of equippedCosmetics where any item
 * the user hasn't unlocked yet is stripped out (set to null).
 * Prevents users from displaying cosmetics above their level.
 * @param {object} equippedCosmetics
 * @param {string[]} unlockedCosmetics - array of unlocked cosmetic IDs
 * @param {number} userLevel
 * @returns {object}
 */
const getSafeEquippedCosmetics = (equippedCosmetics, unlockedCosmetics = [], userLevel = 1) => {
  const unlockedByLevel = getUnlockedCosmeticsForLevel(userLevel);
  const unlockedSet = new Set([...unlockedCosmetics, ...unlockedByLevel]);
  const safe = {};
  for (const [type, cosmeticId] of Object.entries(equippedCosmetics || {})) {
    if (!cosmeticId) {
      safe[type] = null;
      continue;
    }
    const item = getCosmeticById(cosmeticId);
    // Strip if item doesn't exist or user hasn't unlocked it
    safe[type] = (item && unlockedSet.has(cosmeticId)) ? cosmeticId : null;
  }
  return safe;
};

module.exports = {
  RARITY,
  COSMETIC_TYPES,
  COSMETICS_REGISTRY,
  getCosmeticById,
  getUnlockedCosmeticsForLevel,
  DEFAULT_EQUIPPED_COSMETICS,
  getSafeEquippedCosmetics,
};
