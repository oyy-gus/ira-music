/**
 * XP & Level Progression Service
 * Centralized service for XP calculation, level curves, and level-up evaluation.
 */

const { getUnlockedCosmeticsForLevel } = require('../config/cosmetics');

const XP_CONFIG = {
  xpPerMinute: 10,
  maxLevel: 1000,
  eventMultiplier: 1.0,
  seasonMultiplier: 1.0,
};

/**
 * Calculates XP required to advance from `level` to `level + 1`.
 * @param {number} level 
 * @returns {number} Required XP for next level
 */
const getRequiredXPForLevel = (level) => {
  if (level >= XP_CONFIG.maxLevel) return 0;
  // Scalable polynomial level curve
  const baseXP = 150;
  const growthRate = 1.35;
  return Math.floor(baseXP * Math.pow(level, growthRate));
};

/**
 * Calculate level, current level progress, and XP to next level given total XP.
 * @param {number} totalXP 
 */
const calculateProgression = (totalXP = 0) => {
  let xp = Math.max(0, totalXP);
  let level = 1;

  while (level < XP_CONFIG.maxLevel) {
    const reqXP = getRequiredXPForLevel(level);
    if (xp >= reqXP) {
      xp -= reqXP;
      level++;
    } else {
      break;
    }
  }

  if (level >= XP_CONFIG.maxLevel) {
    return {
      level: XP_CONFIG.maxLevel,
      currentXP: xp,
      requiredXP: 0,
      xpToNextLevel: 0,
      progressPercent: 100,
      totalXP,
    };
  }

  const requiredXP = getRequiredXPForLevel(level);
  const xpToNextLevel = Math.max(0, requiredXP - xp);
  const progressPercent = Math.min(100, Math.floor((xp / requiredXP) * 100));

  return {
    level,
    currentXP: xp,
    requiredXP,
    xpToNextLevel,
    progressPercent,
    totalXP,
  };
};

/**
 * Calculate XP gained for a given listening duration in seconds.
 * @param {number} durationSeconds 
 * @param {number} [customMultiplier=1.0] 
 */
const calculateXPGain = (durationSeconds, customMultiplier = 1.0) => {
  const minutes = durationSeconds / 60;
  const multiplier = XP_CONFIG.eventMultiplier * XP_CONFIG.seasonMultiplier * customMultiplier;
  return Math.floor(minutes * XP_CONFIG.xpPerMinute * multiplier);
};

/**
 * Check if adding gained XP results in a level up, and return updated progression + unlocked rewards.
 * @param {number} currentTotalXP 
 * @param {number} xpGained 
 */
const evaluateXPGain = (currentTotalXP = 0, xpGained = 0) => {
  const oldProg = calculateProgression(currentTotalXP);
  const newTotalXP = currentTotalXP + xpGained;
  const newProg = calculateProgression(newTotalXP);

  const leveledUp = newProg.level > oldProg.level;
  let newUnlockedCosmetics = [];

  if (leveledUp) {
    for (let lvl = oldProg.level + 1; lvl <= newProg.level; lvl++) {
      const unlockedAtLvl = getUnlockedCosmeticsForLevel(lvl);
      newUnlockedCosmetics = [...new Set([...newUnlockedCosmetics, ...unlockedAtLvl])];
    }
  }

  return {
    oldLevel: oldProg.level,
    newLevel: newProg.level,
    leveledUp,
    newTotalXP,
    newProgression: newProg,
    newUnlockedCosmetics,
  };
};

module.exports = {
  XP_CONFIG,
  getRequiredXPForLevel,
  calculateProgression,
  calculateXPGain,
  evaluateXPGain,
};
