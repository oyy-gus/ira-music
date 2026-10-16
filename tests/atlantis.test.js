'use strict';

const { calculateZooStats } = require('../src/services/atlantis/zooCalculator');
const atlantisService = require('../src/services/atlantis/atlantisService');
const { pageMembers, pageMemberDetail } = require('../src/web/renderers/membersRenderer');

// Mock Mongoose models
jest.mock('../src/database/models/AtlantisUser', () => {
  const users = new Map();
  return {
    findOne: jest.fn().mockImplementation(({ userId }) => {
      const u = users.get(userId);
      return Promise.resolve(u || null);
    }),
    create: jest.fn().mockImplementation((data) => {
      users.set(data.userId, { ...data });
      return Promise.resolve({ ...data });
    }),
    updateOne: jest.fn().mockImplementation(({ userId }, update) => {
      let u = users.get(userId) || { userId, reminders: {}, stats: {} };
      if (update.$set) {
        for (const [key, val] of Object.entries(update.$set)) {
          if (key.includes('.')) {
            const parts = key.split('.');
            if (!u[parts[0]]) u[parts[0]] = {};
            u[parts[0]][parts[1]] = val;
          } else {
            u[key] = val;
          }
        }
      }
      users.set(userId, u);
      return Promise.resolve({ modifiedCount: 1 });
    }),
    updateMany: jest.fn().mockResolvedValue({ modifiedCount: 1 }),
  };
});

jest.mock('../src/database/models/BotBan', () => {
  const bans = new Map();
  return {
    find: jest.fn().mockImplementation(() => ({
      lean: () => Promise.resolve(Array.from(bans.values())),
    })),
    findOneAndUpdate: jest.fn().mockImplementation(({ userId }, data) => {
      bans.set(userId, data);
      return Promise.resolve(data);
    }),
    deleteOne: jest.fn().mockImplementation(({ userId }) => {
      bans.delete(userId);
      return Promise.resolve({ deletedCount: 1 });
    }),
  };
});

jest.mock('../src/database/models/HuntBotSession', () => {
  const sessions = new Map();
  return {
    find: jest.fn().mockImplementation(() => ({
      lean: () => Promise.resolve(Array.from(sessions.values())),
    })),
    findOneAndUpdate: jest.fn().mockImplementation(({ userId }, data) => {
      sessions.set(userId, data);
      return Promise.resolve(data);
    }),
    deleteOne: jest.fn().mockImplementation(({ userId }) => {
      sessions.delete(userId);
      return Promise.resolve({ deletedCount: 1 });
    }),
  };
});

jest.mock('../src/database/models/AtlantisMember', () => {
  const members = new Map();
  return {
    find: jest.fn().mockImplementation((query = {}) => {
      let list = Array.from(members.values());
      if (query && query.userId) {
        list = list.filter((m) => m.userId === query.userId);
      }
      if (query && query.guildId && query.guildId !== 'all') {
        list = list.filter((m) => m.guildId === query.guildId);
      }
      const queryObj = {
        sort: () => queryObj,
        limit: (n) => {
          list = list.slice(0, n);
          return queryObj;
        },
        lean: () => Promise.resolve([...list]),
        then: (resolve, reject) => Promise.resolve([...list]).then(resolve, reject),
      };
      return queryObj;
    }),
    findOne: jest.fn().mockImplementation((query = {}) => {
      const match = Array.from(members.values()).find((m) => {
        if (query.userId && m.userId !== query.userId) return false;
        if (query.guildId && m.guildId !== query.guildId) return false;
        return true;
      });
      return {
        lean: () => Promise.resolve(match || null),
        sort: () => ({
          lean: () => Promise.resolve(match || null),
        }),
      };
    }),
    findOneAndUpdate: jest.fn().mockImplementation(({ userId }, update) => {
      let m = members.get(userId) || { userId, owosPastWeek: 0, owosArchive: [] };
      if (update.$inc?.owosPastWeek) m.owosPastWeek += update.$inc.owosPastWeek;
      if (update.$set) Object.assign(m, update.$set);
      members.set(userId, m);
      return Promise.resolve(m);
    }),
    updateOne: jest.fn().mockImplementation(({ userId }, update) => {
      let m = members.get(userId) || { userId, owosPastWeek: 0, owosArchive: [] };
      if (update.$set) Object.assign(m, update.$set);
      if (update.$push?.owosArchive) m.owosArchive.push(update.$push.owosArchive);
      members.set(userId, m);
      return Promise.resolve({ modifiedCount: 1 });
    }),
    deleteOne: jest.fn().mockImplementation(({ userId }) => {
      members.delete(userId);
      return Promise.resolve({ deletedCount: 1 });
    }),
    bulkWrite: jest.fn().mockResolvedValue({ modifiedCount: 1 }),
    __membersMap: members,
  };
});

jest.mock('../src/database/repositories/guildRepository', () => {
  const guildSettings = {
    guildId: 'guild-test-1',
    prefix: '*',
    atlantisSettings: {
      deleteBotMessagesChannels: ['chan-bot-del'],
      deleteUserMessagesChannels: ['chan-user-del'],
      owoChannels: ['chan-owo-only'],
      deleteRules: [{ channelId: 'chan-rules', word: '!cmd' }],
      owoPrefix: 'owo',
    },
  };
  return {
    getGuildSettings: jest.fn().mockResolvedValue(guildSettings),
    updateGuildSettings: jest.fn().mockImplementation((guildId, update) => {
      Object.assign(guildSettings, update);
      return Promise.resolve(guildSettings);
    }),
  };
});

describe('Atlantis Module & Subsystem Tests', () => {
  describe('1. Zoo Calculator Tests', () => {
    test('parses superscript numbers and computes rank rewards correctly', () => {
      const sampleZoo = `
:common: ²⁵
:uncommon: ¹⁰
:epic: ²
:blank: ⁵
`;
      const result = calculateZooStats(sampleZoo);
      expect(result.totals.common).toBeDefined();
      expect(result.totals.common.count).toBe(25);
      expect(result.totals.common.cowoncy).toBe(25 * 1);
      expect(result.totals.common.essence).toBe(25 * 1);

      expect(result.totals.uncommon).toBeDefined();
      expect(result.totals.uncommon.count).toBe(10);
      expect(result.totals.uncommon.cowoncy).toBe(10 * 3);
      expect(result.totals.uncommon.essence).toBe(10 * 5);

      // epic has 2 + 5 (from blank) = 7
      expect(result.totals.epic).toBeDefined();
      expect(result.totals.epic.count).toBe(7);
      expect(result.totals.epic.cowoncy).toBe(7 * 250);
      expect(result.totals.epic.essence).toBe(7 * 250);

      expect(result.totalCowoncy).toBe(25 * 1 + 10 * 3 + 7 * 250);
      expect(result.formatted).toContain('common');
      expect(result.formatted).toContain('epic');
    });

    test('handles empty or non-matching zoo text gracefully', () => {
      const result = calculateZooStats('Just regular chat text');
      expect(result.totalCowoncy).toBe(0);
      expect(result.totalEssence).toBe(0);
      expect(Object.keys(result.totals).length).toBe(0);
    });
  });

  describe('2. Atlantis Service & Auto-Moderation Tests', () => {
    test('identifies and registers bot bans', async () => {
      expect(atlantisService.isBotBanned('user-bad-1')).toBe(false);
      await atlantisService.addBotBan('user-bad-1', 'Spammer#0001', 'Abusing commands', 'AdminTester');
      expect(atlantisService.isBotBanned('user-bad-1')).toBe(true);

      const allBans = await atlantisService.getAllBotBans();
      expect(allBans.some((b) => b.userId === 'user-bad-1')).toBe(true);

      await atlantisService.removeBotBan('user-bad-1');
      expect(atlantisService.isBotBanned('user-bad-1')).toBe(false);
    });

    test('deletes bot messages in deleteBotMessagesChannels', async () => {
      const deleteMock = jest.fn().mockResolvedValue({});
      const mockMsg = {
        id: 'msg-1',
        guild: { id: 'guild-test-1' },
        channel: { id: 'chan-bot-del' },
        author: { bot: true },
        content: 'I am a bot message',
        delete: deleteMock,
      };

      const deleted = await atlantisService.handleAutoModeration(mockMsg);
      expect(deleted).toBe(true);
    });

    test('deletes user messages in deleteUserMessagesChannels', async () => {
      const deleteMock = jest.fn().mockResolvedValue({});
      const mockMsg = {
        id: 'msg-2',
        guild: { id: 'guild-test-1' },
        channel: { id: 'chan-user-del' },
        author: { bot: false },
        content: 'Hello world',
        delete: deleteMock,
      };

      const deleted = await atlantisService.handleAutoModeration(mockMsg);
      expect(deleted).toBe(true);
    });

    test('allows only owo/uwu in owoChannels', async () => {
      const deleteMock = jest.fn().mockResolvedValue({});
      const validMsg = {
        id: 'msg-3',
        guild: { id: 'guild-test-1' },
        channel: { id: 'chan-owo-only' },
        author: { bot: false },
        content: 'owo',
        delete: deleteMock,
      };

      const deleted = await atlantisService.handleAutoModeration(validMsg);
      expect(deleted).toBe(false);

      const invalidMsg = {
        id: 'msg-4',
        guild: { id: 'guild-test-1' },
        channel: { id: 'chan-owo-only' },
        author: { bot: false },
        content: 'hello friends',
        delete: deleteMock,
      };

      const deletedInvalid = await atlantisService.handleAutoModeration(invalidMsg);
      expect(deletedInvalid).toBe(true);
    });

    test('deletes messages starting with specified delete rule prefix', async () => {
      const deleteMock = jest.fn().mockResolvedValue({});
      const ruleMsg = {
        id: 'msg-5',
        guild: { id: 'guild-test-1' },
        channel: { id: 'chan-rules' },
        author: { bot: false },
        content: '!cmd start game',
        delete: deleteMock,
      };

      const deleted = await atlantisService.handleAutoModeration(ruleMsg);
      expect(deleted).toBe(true);
    });
  });

  describe('3. Reminders & Custom Timers Command Tests', () => {
    test('toggle hunt reminder command executes', async () => {
      const huntCmd = require('../src/commands/reminders/hunt');
      let replyPayload = null;
      const mockMsg = {
        author: { id: 'user-reminder-1' },
        reply: jest.fn().mockImplementation((payload) => {
          replyPayload = payload;
          return Promise.resolve(payload);
        }),
      };

      await huntCmd.execute({ message: mockMsg, args: ['on'] });
      expect(mockMsg.reply).toHaveBeenCalled();
      expect(replyPayload.embeds[0].data.title).toContain('Hunt');
    });

    test('custom timer set and delete executes without error', async () => {
      const customCmd = require('../src/commands/reminders/custom');
      let replyPayload = null;
      const mockMsg = {
        author: { id: 'user-custom-1' },
        reply: jest.fn().mockImplementation((payload) => {
          replyPayload = payload;
          return Promise.resolve(payload);
        }),
      };

      // Set custom timer: b 1M30S owo pray
      await customCmd.execute({
        message: mockMsg,
        args: ['set', 'b', '1M30S', 'owo', 'pray'],
        rawArgsString: 'set b 1M30S owo pray',
        prefix: '*',
      });
      expect(mockMsg.reply).toHaveBeenCalled();
      expect(replyPayload.embeds[0].data.title).toContain('Created');

      // Delete custom timer
      await customCmd.execute({
        message: mockMsg,
        args: ['delete', '1'],
        rawArgsString: 'delete 1',
        prefix: '*',
      });
      expect(replyPayload.embeds[0].data.title).toContain('Deleted');
    });
  });

  describe('4. Web Community Renderers Tests', () => {
    test('pageMembers renders valid HTML layout with AOTW and members', async () => {
      const mockClient = {
        user: { username: 'Ira Music', displayAvatarURL: () => 'https://avatar.png' },
      };
      const mockUser = { username: 'Tester', avatar_url: 'https://avatar.png' };

      const html = await pageMembers(mockClient, mockUser);
      expect(typeof html).toBe('string');
      expect(html).toContain('Community Members');
      expect(html).toContain('Possible Atlantis of the Week');
      expect(html).toContain('Auto-Resets Weekly');
    });

    test('pageMemberDetail renders valid HTML for a member', async () => {
      const AtlantisMember = require('../src/database/models/AtlantisMember');
      AtlantisMember.__membersMap.set('member-test-1', {
        userId: 'member-test-1',
        userTag: 'OwoFan#1234',
        nickname: 'Fan',
        avatar: 'https://cdn.discordapp.com/avatars/1/abc.png',
        level: 2,
        premium: new Date(),
        joinedAtlantis: new Date(),
        owosPastWeek: 75,
        owosArchive: [
          { weekOf: '10/4 - 10/10', amountOfOwos: 60, hitreq: '✔️', time: '12345678' },
          { weekOf: '9/27 - 10/3', amountOfOwos: 30, hitreq: '❌', time: '12345679' },
        ],
      });

      const mockClient = {
        user: { username: 'Ira Music', displayAvatarURL: () => 'https://avatar.png' },
      };
      const html = await pageMemberDetail(mockClient, null, 'member-test-1');
      expect(typeof html).toBe('string');
      expect(html).toContain('OwoFan#1234');
      expect(html).toContain('Hit Requirement');
      expect(html).toContain('Booster');
      expect(html).toContain('Excuse');
    });
  });

  describe('5. Atlantis Stats Canvas Rendering Tests', () => {
    test('generateGlobalOwoStatsCard produces valid PNG buffer', async () => {
      const { generateGlobalOwoStatsCard } = require('../src/utils/atlantisStatsCanvas');
      const mockUser = { id: 'user-canvas-1', username: 'GamerOne', displayName: 'Gamer' };
      const stats = {
        owoCount: 1250,
        huntCount: 780,
        battleCount: 240,
        praycurseCount: 85,
        completedHuntbots: 15,
        totalHuntbotTime: 86400000,
        dailyOwoCount: 42,
        dailyHuntCount: 18,
        dailyBattleCount: 6,
        dailyPraycurseCount: 3,
      };

      const buffer = await generateGlobalOwoStatsCard({ user: mockUser, stats });
      expect(Buffer.isBuffer(buffer)).toBe(true);
      expect(buffer.length).toBeGreaterThan(1000);
      // Check PNG magic bytes: 0x89, 0x50, 0x4E, 0x47
      expect(buffer[0]).toBe(0x89);
      expect(buffer[1]).toBe(0x50);
      expect(buffer[2]).toBe(0x4E);
      expect(buffer[3]).toBe(0x47);
    });

    test('generateServerOwoStatsCard produces valid PNG buffer', async () => {
      const { generateServerOwoStatsCard } = require('../src/utils/atlantisStatsCanvas');
      const mockUser = { id: 'user-canvas-2', username: 'ServerFan', displayName: 'Fan' };
      const mockGuild = { id: 'guild-canvas-1', name: 'Elite OwO Realm' };
      const guildStats = {
        owoCount: 520,
        huntCount: 310,
        battleCount: 95,
        praycurseCount: 40,
        dailyOwoCount: 25,
        dailyHuntCount: 12,
        dailyBattleCount: 4,
        dailyPraycurseCount: 1,
      };

      const buffer = await generateServerOwoStatsCard({ user: mockUser, guild: mockGuild, guildStats });
      expect(Buffer.isBuffer(buffer)).toBe(true);
      expect(buffer.length).toBeGreaterThan(1000);
      // Check PNG magic bytes
      expect(buffer[0]).toBe(0x89);
      expect(buffer[1]).toBe(0x50);
      expect(buffer[2]).toBe(0x4E);
      expect(buffer[3]).toBe(0x47);
    });
  });
});
