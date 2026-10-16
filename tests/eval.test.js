const evalCommand = require('../src/commands/developer/eval');

describe('Eval Command Tests', () => {
  test('eval command handles large output without exceeding Discord embed field limits', async () => {
    let replyPayload = null;
    const mockMessage = {
      reply: jest.fn().mockImplementation((payload) => {
        replyPayload = payload;
        return Promise.resolve(payload);
      }),
    };

    // Code returning a 5000 character string output
    const rawArgsString = "'A'.repeat(5000)";

    await evalCommand.execute({ message: mockMessage, rawArgsString, client: {} });

    expect(mockMessage.reply).toHaveBeenCalledTimes(1);
    expect(replyPayload).not.toBeNull();
    expect(replyPayload.embeds).toBeDefined();

    const embed = replyPayload.embeds[0];
    expect(embed.data.fields).toBeDefined();

    // Check Output field
    const outputField = embed.data.fields.find((f) => f.name.includes('Output'));
    expect(outputField).toBeDefined();
    // Discord embed field value limit is 1024 characters
    expect(outputField.value.length).toBeLessThanOrEqual(1024);
    expect(outputField.value).toContain('(truncated)');
  });
});
