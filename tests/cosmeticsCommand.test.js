const cosmeticsCmd = require('../src/commands/music/cosmetics');
const userRepo = require('../src/database/repositories/userRepository');

jest.mock('../src/database/repositories/userRepository');

describe('Cosmetics Command Clean SelectMenu UI Tests', () => {
  let mockMessage;

  beforeEach(() => {
    jest.clearAllMocks();
    mockMessage = {
      author: { id: 'user-123', username: 'TestUser' },
      reply: jest.fn().mockImplementation(async (payload) => {
        return {
          ...payload,
          createMessageComponentCollector: jest.fn().mockReturnValue({
            on: jest.fn(),
          }),
        };
      }),
    };

    userRepo.getUser.mockResolvedValue({
      discordId: 'user-123',
      xp: 5000,
      unlockedCosmetics: ['frame_basic', 'frame_silver'],
      equippedCosmetics: { frame: 'frame_basic' },
    });

    userRepo.equipCosmetic.mockResolvedValue(true);
  });

  test('default *cosmetics shows Overview embed with clean Category SelectMenu', async () => {
    await cosmeticsCmd.execute({ message: mockMessage, args: [], client: {} });

    expect(mockMessage.reply).toHaveBeenCalledTimes(1);
    const replyPayload = mockMessage.reply.mock.calls[0][0];

    expect(replyPayload.embeds).toHaveLength(1);
    const embed = replyPayload.embeds[0].data;
    expect(embed.title).toContain('PROFILE COSMETICS & EQUIPMENT');

    // Overview has 1 component row (Category Select Menu)
    expect(replyPayload.components).toHaveLength(1);
    expect(replyPayload.components[0].components[0].data.custom_id).toBe('cosm_cat_jump');
  });

  test('*cosmetics frames opens category page with items, category menu, and equip SelectMenu', async () => {
    await cosmeticsCmd.execute({ message: mockMessage, args: ['frames'], client: {} });

    expect(mockMessage.reply).toHaveBeenCalledTimes(1);
    const replyPayload = mockMessage.reply.mock.calls[0][0];

    expect(replyPayload.embeds).toHaveLength(1);
    const embed = replyPayload.embeds[0].data;
    expect(embed.title).toContain('FRAMES');

    // Category view has 2 component rows: Row 1 = Category Select Menu, Row 2 = Equip Select Menu
    expect(replyPayload.components).toHaveLength(2);
    expect(replyPayload.components[0].components[0].data.custom_id).toBe('cosm_cat_jump');
    expect(replyPayload.components[1].components[0].data.custom_id).toBe('cosm_equip_select');
  });

  test('*cosmetics frame_silver equips cosmetic directly', async () => {
    await cosmeticsCmd.execute({ message: mockMessage, args: ['frame_silver'], client: {} });

    expect(userRepo.equipCosmetic).toHaveBeenCalledWith('user-123', 'frame_silver');
    expect(mockMessage.reply).toHaveBeenCalledWith(expect.stringContaining('Successfully equipped'));
  });
});
