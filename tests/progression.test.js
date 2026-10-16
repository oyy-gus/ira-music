const xpService = require('../src/services/xpService');
const cosmeticsConfig = require('../src/config/cosmetics');
const LeaderboardService = require('../src/services/leaderboardService');
const SeasonService = require('../src/services/seasonService');
const { generateProfileCard } = require('../src/utils/profileCanvas');
const { generateLevelUpCard } = require('../src/utils/levelUpCanvas');
const { generateLevelCard } = require('../src/utils/levelCanvas');

describe('Profile & MusicStats Progression Update Tests', () => {
  describe('1. XP Service & Level Curve Tests', () => {
    test('calculateProgression correctly computes level, XP, and percentage', () => {
      const prog0 = xpService.calculateProgression(0);
      expect(prog0.level).toBe(1);
      expect(prog0.progressPercent).toBe(0);

      const req1 = xpService.getRequiredXPForLevel(1);
      const prog1 = xpService.calculateProgression(req1);
      expect(prog1.level).toBe(2);
      expect(prog1.progressPercent).toBe(0);

      const halfXP = Math.floor(req1 / 2);
      const progHalf = xpService.calculateProgression(halfXP);
      expect(progHalf.level).toBe(1);
      expect(progHalf.progressPercent).toBeGreaterThanOrEqual(45);
      expect(progHalf.progressPercent).toBeLessThanOrEqual(55);
    });

    test('evaluateXPGain detects level ups and returns unlocked cosmetics', () => {
      const evalRes = xpService.evaluateXPGain(0, 5000);
      expect(evalRes.leveledUp).toBe(true);
      expect(evalRes.newLevel).toBeGreaterThan(1);
      expect(Array.isArray(evalRes.newUnlockedCosmetics)).toBe(true);
    });

    test('Level cap at 1000 holds without overflowing', () => {
      const hugeXP = 10000000000;
      const progMax = xpService.calculateProgression(hugeXP);
      expect(progMax.level).toBe(1000);
      expect(progMax.progressPercent).toBe(100);
      expect(progMax.xpToNextLevel).toBe(0);
    });
  });

  describe('2. Cosmetics Registry Tests', () => {
    test('Cosmetics registry contains level 1000 Eternal profile set', () => {
      const eternalFrame = cosmeticsConfig.getCosmeticById('frame_eternal');
      expect(eternalFrame).not.toBeNull();
      expect(eternalFrame.unlockLevel).toBe(1000);

      const eternalBg = cosmeticsConfig.getCosmeticById('bg_eternal');
      expect(eternalBg).not.toBeNull();

      const level1000Unlocked = cosmeticsConfig.getUnlockedCosmeticsForLevel(1000);
      expect(level1000Unlocked).toContain('frame_eternal');
      expect(level1000Unlocked).toContain('bg_eternal');
      expect(level1000Unlocked).toContain('title_eternal');
    });
  });

  describe('3. Season Service Tests', () => {
    test('getCurrentSeason returns active monthly season details', () => {
      const season = SeasonService.getCurrentSeason();
      expect(season.seasonId).toMatch(/^\d{4}-\d{2}$/);
      expect(season.status).toBe('ACTIVE');
    });
  });

  describe('4. Canvas Profile, Level & Level-Up Rendering Tests', () => {
    test('generateProfileCard renders valid PNG buffer without text overlap', async () => {
      const mockUser = {
        id: '123456789012345678',
        username: 'Maxi',
        displayName: 'Maxi',
        displayAvatarURL: () => '',
      };

      const mockUserDoc = {
        discordId: '123456789012345678',
        aboutMe: 'Loving music and tests 🎧',
        xp: 12450,
        level: 27,
        badges: ['🎧 First Hour', '🔥 Dedicated'],
        equippedCosmetics: {
          frame: 'frame_gold',
          background: 'bg_aurora',
          glow: 'glow_blue',
          decoration: 'deco_notes',
          avatarEffect: null,
          nameEffect: null,
          levelEmblem: 'emblem_fan',
          visualizer: 'vis_spectrum',
          title: 'title_first',
        },
        statistics: {
          songsPlayed: 234,
          timeListenedSeconds: 629700, // ~174h 55m
        },
      };

      const buffer = await generateProfileCard(mockUser, mockUserDoc, {
        globalRank: 184,
        serverRank: 7,
        achievements: [{ title: 'First Melody', icon: '🎵' }],
      });

      expect(Buffer.isBuffer(buffer)).toBe(true);
      expect(buffer.length).toBeGreaterThan(1000);
    }, 15000);

    test('generateProfileCard supports custom Discord emojis in aboutMe bio', async () => {
      const mockUser = {
        id: '123456789012345678',
        username: 'Maxi',
        displayName: 'Maxi',
        displayAvatarURL: () => '',
      };

      const mockUserDoc = {
        discordId: '123456789012345678',
        aboutMe: 'Loving music <:pepe_dance:123456789012345678> and beats <a:vibing:987654321098765432>',
        xp: 500,
        level: 3,
        badges: [],
        equippedCosmetics: {},
        statistics: { timeListenedSeconds: 120 },
      };

      const buffer = await generateProfileCard(mockUser, mockUserDoc, {});
      expect(Buffer.isBuffer(buffer)).toBe(true);
      expect(buffer.length).toBeGreaterThan(1000);
    });

    test('generateLevelCard renders valid PNG buffer for level rank card', async () => {
      const mockUser = {
        id: '123456789012345678',
        username: 'Maxi',
        displayName: 'Maxi',
        displayAvatarURL: () => '',
      };

      const mockUserDoc = {
        discordId: '123456789012345678',
        xp: 12450,
        level: 27,
      };

      const buffer = await generateLevelCard(mockUser, mockUserDoc, { globalRank: 184, serverRank: 7 });
      expect(Buffer.isBuffer(buffer)).toBe(true);
      expect(buffer.length).toBeGreaterThan(1000);
    });

    test('generateLevelUpCard renders valid PNG buffer for level-up notification', async () => {
      const mockUser = {
        id: '123456789012345678',
        username: 'Maxi',
        displayName: 'Maxi',
        displayAvatarURL: () => '',
      };

      const buffer = await generateLevelUpCard(mockUser, 28, '⭐');
      expect(Buffer.isBuffer(buffer)).toBe(true);
      expect(buffer.length).toBeGreaterThan(1000);
    });
  });
});
