const { MessageFlags } = require('discord.js');
const logger = require('../logger/logger');

/**
 * Adapter to bridge Discord.js ChatInputCommandInteraction to prefix command handlers
 */
const runAsSlash = async (interaction, client, commandModule, args = [], rawArgsString = '') => {
  // Extract mentioned user/member if passed in interaction options
  let targetUser = null;
  let targetMember = null;
  if (interaction.options) {
    try {
      targetUser = interaction.options.getUser('user') || interaction.options.getUser('target') || null;
      targetMember = interaction.options.getMember('user') || interaction.options.getMember('target') || null;
    } catch (e) {
      // Ignore if options fail to resolve
    }
  }

  // Construct a synthetic Message object compatible with prefix commands
  const fakeMessage = {
    guild: interaction.guild,
    channel: interaction.channel,
    member: interaction.member,
    author: interaction.user,
    user: interaction.user,
    createdTimestamp: interaction.createdTimestamp,
    client: interaction.client,
    mentions: {
      members: { first: () => targetMember || null },
      users: { first: () => targetUser || null },
      channels: { first: () => null },
      roles: { first: () => null },
    },
    content: `/${interaction.commandName} ${rawArgsString}`.trim(),
    reply: async (options) => {
      let opt = typeof options === 'string' ? { content: options } : { ...options };
      if (opt.ephemeral) {
        opt.flags = MessageFlags.Ephemeral;
        delete opt.ephemeral;
      }
      if (interaction.deferred || interaction.replied) {
        return await interaction.editReply(opt);
      }
      await interaction.reply(opt);
      return await interaction.fetchReply();
    },
  };

  try {
    return await commandModule.execute({
      message: fakeMessage,
      args: args.filter((a) => a !== null && a !== undefined),
      rawArgsString: rawArgsString || '',
      client,
      prefix: '/',
    });
  } catch (error) {
    logger.error(`[CommandBridge] Error executing slash command /${interaction.commandName}:`, {
      error: error.message,
      stack: error.stack,
    });
    const errObj = { content: '❌ An error occurred while processing this Slash Command.', flags: MessageFlags.Ephemeral };
    if (interaction.deferred || interaction.replied) {
      await interaction.editReply(errObj).catch(() => {});
    } else {
      await interaction.reply(errObj).catch(() => {});
    }
  }
};

module.exports = {
  runAsSlash,
};
