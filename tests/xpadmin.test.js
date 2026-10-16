const userRepository = require('../src/database/repositories/userRepository');

describe('XP Admin Functions & Bot Validation', () => {
  test('userRepository should export XP admin functions', () => {
    expect(typeof userRepository.addXPToUser).toBe('function');
    expect(typeof userRepository.removeXPFromUser).toBe('function');
    expect(typeof userRepository.resetUserXP).toBe('function');
    expect(typeof userRepository.resetGlobalXP).toBe('function');
  });
});
