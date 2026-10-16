'use strict';

const {
  resolvePlaceholders,
  normalizeCardConfig,
  normalizeEmbedConfig,
  checkChannelPermissions,
  renderPreview,
  DEFAULT_CARD_WELCOME,
  DEFAULT_CARD_LEAVE,
} = require('../src/services/greetingService');

const { renderGreetingCard } = require('../src/services/renderers/GreetingCardRenderer');
const { validateMagicBytes } = require('../src/services/uploadService');

describe('Greeting System V2 - Single Base Design & Visual Customization', () => {
  const dummyMember = {
    id: '999888777',
    displayName: 'TestUser',
    user: {
      username: 'testuser',
      displayAvatarURL: () => 'https://cdn.discordapp.com/embed/avatars/0.png',
    },
  };

  const dummyGuild = {
    name: 'Ira Test Server',
    memberCount: 42,
  };

  test('resolvePlaceholders correctly substitutes all tokens', () => {
    const tmpl = 'Welcome {user} ({username} / {displayName}) to {server}! Total: {memberCount} (#{memberNumber}). ID: {userId} Avatar: {avatar}';
    const result = resolvePlaceholders(tmpl, dummyMember, dummyGuild);

    expect(result).toContain('<@999888777>');
    expect(result).toContain('testuser');
    expect(result).toContain('TestUser');
    expect(result).toContain('Ira Test Server');
    expect(result).toContain('42');
    expect(result).toContain('999888777');
    expect(result).toContain('https://cdn.discordapp.com/embed/avatars/0.png');
  });

  test('normalizeCardConfig merges defaults correctly', () => {
    const normalized = normalizeCardConfig('welcome', {
      colors: { primary: '#FF0000' },
      avatar: { frame: 'glow' },
    });

    expect(normalized.colors.primary).toBe('#FF0000');
    expect(normalized.colors.secondary).toBe('#3B82F6');
    expect(normalized.avatar.frame).toBe('glow');
    expect(normalized.avatar.shape).toBe('circle');
    expect(normalized.visibility.heading).toBe(true);
  });

  test('normalizeEmbedConfig merges defaults correctly', () => {
    const normalized = normalizeEmbedConfig('welcome', {
      title: 'Custom Title',
      color: '#FF0055',
    });

    expect(normalized.title).toBe('Custom Title');
    expect(normalized.color).toBe('#FF0055');
    expect(normalized.authorName).toBe('{displayName}');
    expect(normalized.showCanvasCard).toBe(true);
  });

  test('checkChannelPermissions detects missing permissions accurately', () => {
    const mockGuild = {
      members: { me: { id: 'bot-123' } },
    };

    const mockChannelAll = {
      permissionsFor: () => ({
        has: () => true,
      }),
    };

    const mockChannelMissing = {
      permissionsFor: () => ({
        has: (flag) => flag === 'ViewChannel' || flag === 'SendMessages',
      }),
    };

    const resAll = checkChannelPermissions(mockChannelAll, mockGuild, 'embed', true);
    expect(resAll.ok).toBe(true);
    expect(resAll.missing).toHaveLength(0);

    const resMissing = checkChannelPermissions(mockChannelMissing, mockGuild, 'embed', true);
    expect(resMissing.ok).toBe(false);
    expect(resMissing.missing).toContain('Embed Links');
    expect(resMissing.missing).toContain('Attach Files');
  });

  test('renderGreetingCard renders a valid PNG buffer for Welcome', async () => {
    const buffer = await renderGreetingCard({
      type: 'welcome',
      displayName: 'TestUser',
      username: 'testuser',
      guildName: 'Ira Community',
      memberCount: 152,
      memberNumber: 152,
      cardConfig: DEFAULT_CARD_WELCOME,
    });

    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.length).toBeGreaterThan(100);
  });

  test('renderGreetingCard renders a valid PNG buffer for Leave', async () => {
    const buffer = await renderGreetingCard({
      type: 'leave',
      displayName: 'TestUser',
      username: 'testuser',
      guildName: 'Ira Community',
      memberCount: 151,
      cardConfig: DEFAULT_CARD_LEAVE,
    });

    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.length).toBeGreaterThan(100);
  });

  test('renderPreview returns a base64 data URL', async () => {
    const dataUrl = await renderPreview('welcome', DEFAULT_CARD_WELCOME);
    expect(typeof dataUrl).toBe('string');
    expect(dataUrl).toMatch(/^data:image\/png;base64,/);
  });

  test('validateMagicBytes identifies valid PNG / JPG and rejects fake buffers', () => {
    const pngBuffer = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    const jpgBuffer = Buffer.from([0xff, 0xd8, 0xff, 0xe0]);
    const fakeBuffer = Buffer.from([0x00, 0x01, 0x02, 0x03]);

    expect(validateMagicBytes(pngBuffer)).toBe('png');
    expect(validateMagicBytes(jpgBuffer)).toBe('jpg');
    expect(validateMagicBytes(fakeBuffer)).toBe(false);
  });
});
