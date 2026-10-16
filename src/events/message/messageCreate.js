const { EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const config = require('../../config');
const logger = require('../../logger/logger');
const { parseArguments } = require('../../handlers/commandHandler');
const CustomError = require('../../utils/CustomError');
const { sendAutoDelete } = require('../../utils/channelUtils');
const WebhookLogger = require('../../services/webhookLogger');
const { getEmoji } = require('../../config/emojis');

const guildRepo = require('../../database/repositories/guildRepository');

module.exports = {
  name: 'messageCreate',
  once: false,
  async execute(message, client) {
    if (message.author.bot || !message.guild) return;

    // Check if user is bot-banned
    const atlantisService = require('../../services/atlantis/atlantisService');
    if (atlantisService.isBotBanned(message.author.id)) return;

    // Bot Channel Permission resolution (ViewChannel & SendMessages)
    const me = message.guild.members.me || message.guild.members.cache.get(client.user.id);
    const botChannelPerms = message.channel.permissionsFor(me);

    const isThread = typeof message.channel.isThread === 'function' && message.channel.isThread();
    const sendPerm = isThread ? PermissionFlagsBits.SendMessagesInThreads : PermissionFlagsBits.SendMessages;

    const canSendInChannel = botChannelPerms
      ? (botChannelPerms.has(sendPerm) || botChannelPerms.has('SendMessages') || botChannelPerms.has('SendMessagesInThreads'))
      : true;

    // Helper to send response via Direct Message if bot lacks SendMessages permission in the channel
    const safeSendDM = async (payload) => {
      try {
        return await message.author.send(payload);
      } catch (dmErr) {
        logger.debug(`[MessageCreate] Could not send DM to user ${message.author.id} (${message.author.tag}): ${dmErr.message}`);
        return null;
      }
    };

    // Override message.reply & message.channel.send to seamlessly send DM when channel SendMessages is missing
    const originalReply = message.reply.bind(message);
    message.reply = async (options) => {
      if (!canSendInChannel) {
        return safeSendDM(options);
      }
      try {
        return await originalReply(options);
      } catch (err) {
        if (err.code === 50013 || err.message?.includes('Missing Permissions')) {
          return safeSendDM(options);
        }
        throw err;
      }
    };

    if (message.channel?.send) {
      const originalChannelSend = message.channel.send.bind(message.channel);
      message.channel.send = async (options) => {
        if (!canSendInChannel) {
          return safeSendDM(options);
        }
        try {
          return await originalChannelSend(options);
        } catch (err) {
          if (err.code === 50013 || err.message?.includes('Missing Permissions')) {
            return safeSendDM(options);
          }
          throw err;
        }
      };
    }

    let prefix = config.discord.defaultPrefix;
    try {
      const guildSettings = await guildRepo.getGuildSettings(message.guild.id);
      if (guildSettings && guildSettings.prefix) {
        prefix = guildSettings.prefix;
      }
    } catch (err) {
      logger.warn(`Failed to fetch guild settings for ${message.guild.id}, using default prefix`, { error: err.message });
    }

    if (!message.content.startsWith(prefix)) return;

    const rawContent = message.content.slice(prefix.length).trim();
    if (!rawContent) return;

    const firstSpaceIndex = rawContent.search(/\s/);
    const cmdName = (firstSpaceIndex === -1 ? rawContent : rawContent.substring(0, firstSpaceIndex)).toLowerCase();
    const rawArgsString = firstSpaceIndex === -1 ? '' : rawContent.substring(firstSpaceIndex + 1).trim();

    const commandName = client.aliases.get(cmdName) || cmdName;
    const command = client.commands.get(commandName);

    if (!command) return;

    const emoji = (key) => {
      const e = getEmoji(key, client);
      return e ? `${e} ` : '';
    };

    // Owner-only command restriction
    if (command.ownerOnly && message.author.id !== config.discord.ownerId) {
      const embed = new EmbedBuilder()
        .setTitle(`${emoji('lock')}Developer Only`)
        .setDescription('This command is restricted to the bot developer.')
        .setColor(0xED4245);
      return sendAutoDelete(message.reply({ embeds: [embed] }), 6000);
    }

    // Maintenance mode check
    const featureFlagService = require('../../services/featureFlagService');
    if (featureFlagService.isMaintenance() && message.author.id !== config.discord.ownerId) {
      const embed = new EmbedBuilder()
        .setTitle(`${emoji('tools')}System Maintenance`)
        .setDescription(featureFlagService.maintenanceMode.message)
        .setColor(0xFEE75C);
      return sendAutoDelete(message.reply({ embeds: [embed] }), 6000);
    }

    // Emergency Lockdown check
    const emergencyLockdown = require('../../security/emergencyLockdown');
    const lockdownStatus = emergencyLockdown.isLocked(command.name, message.guild.id, command.category);
    if (lockdownStatus.locked) {
      const embed = new EmbedBuilder()
        .setTitle(`${emoji('lock')}System Lockdown`)
        .setDescription(lockdownStatus.reason || 'Command execution is temporarily restricted.')
        .setColor(0xED4245);
      return sendAutoDelete(message.reply({ embeds: [embed] }), 6000);
    }

    // Command Abuse Protection (Rate limiting & spam control)
    const commandAbuseProtection = require('../../security/commandAbuseProtection');
    const abuseCheck = commandAbuseProtection.check(message.author.id, 'command_rate');
    if (abuseCheck.limited) {
      const retrySec = (abuseCheck.retryAfterMs / 1000).toFixed(1);
      const embed = new EmbedBuilder()
        .setTitle(`${emoji('forbidden')}Rate Limit Exceeded`)
        .setDescription(`You are executing commands too quickly. Please wait **${retrySec}s** before trying again.`)
        .setColor(0xED4245);
      return sendAutoDelete(message.reply({ embeds: [embed] }), 6000);
    }

    // Advanced Permission Engine resolution
    const { PermissionEngine } = require('../../security/permissionEngine');
    const permResult = await PermissionEngine.evaluatePermission({
      guildId: message.guild.id,
      member: message.member,
      commandName: command.name,
    });

    if (!permResult.allowed) {
      const SuspiciousActivityDetector = require('../../security/suspiciousActivity');
      SuspiciousActivityDetector.trackActivity(message.author.id, message.guild.id, 'PERMISSION_DENIED_BURST', command.name);

      const embed = new EmbedBuilder()
        .setTitle(`${emoji('error')}Permission Denied`)
        .setDescription(`You do not have permission to execute \`${prefix}${command.name}\` (${permResult.node}).`)
        .setColor(0xED4245);
      return sendAutoDelete(message.reply({ embeds: [embed] }), 6000);
    }

    // Cooldown check
    if (!client.cooldowns.has(command.name)) {
      client.cooldowns.set(command.name, new Map());
    }

    const now = Date.now();
    const timestamps = client.cooldowns.get(command.name);
    const cooldownAmount = (command.cooldown || 3) * 1000;

    if (timestamps.has(message.author.id)) {
      const expirationTime = timestamps.get(message.author.id) + cooldownAmount;
      if (now < expirationTime) {
        const timeLeft = ((expirationTime - now) / 1000).toFixed(1);
        const embed = new EmbedBuilder()
          .setTitle(`${emoji('clock')}Cooldown Limit`)
          .setDescription(`Please wait **${timeLeft}s** before reusing \`${prefix}${command.name}\`.`)
          .setColor(0xFEE75C);
        return sendAutoDelete(message.reply({ embeds: [embed] }), 6000);
      }
    }

    timestamps.set(message.author.id, now);
    setTimeout(() => timestamps.delete(message.author.id), cooldownAmount);

    // Discord Native Permission check
    if (command.userPermissions && Array.isArray(command.userPermissions)) {
      const missingPermissions = message.channel.permissionsFor(message.member).missing(command.userPermissions);
      if (missingPermissions.length > 0) {
        const embed = new EmbedBuilder()
          .setTitle(`${emoji('error')}Permission Denied`)
          .setDescription(`You need the following permissions to execute this command:\n\`${missingPermissions.join(', ')}\``)
          .setColor(0xED4245);
        return sendAutoDelete(message.reply({ embeds: [embed] }), 6000);
      }
    }

    const args = parseArguments(rawArgsString);

    try {
      logger.info(`Executing command: ${command.name}`, {
        guildId: message.guild.id,
        userId: message.author.id,
        command: command.name,
      });

      await command.execute({ message, args, rawArgsString, client, prefix });

      // Send Command Webhook Log
      WebhookLogger.sendCommandLog({
        commandName: command.name,
        user: message.member || message.author,
        guild: message.guild,
        channel: message.channel,
        argsString: rawArgsString,
        prefix,
      });
    } catch (error) {
      if (error instanceof CustomError) {
        logger.warn(`Custom error in command ${command.name}: ${error.code}`, {
          guildId: message.guild.id,
          userId: message.author.id,
          command: command.name,
          details: error.technicalDetails,
        });

        const embed = new EmbedBuilder()
          .setTitle(`${emoji('warning')}Music Command Warning`)
          .setDescription(error.userMessage)
          .setColor(0xFEE75C);
        return sendAutoDelete(message.reply({ embeds: [embed] }), 6000);
      }

      logger.error(`Unhandled execution error in command ${command.name}`, {
        guildId: message.guild.id,
        userId: message.author.id,
        command: command.name,
        error: error.message,
        stack: error.stack,
      });

      const embed = new EmbedBuilder()
        .setTitle(`${emoji('error')}Command Error`)
        .setDescription('An unexpected error occurred while executing this command.')
        .setColor(0xED4245);
      return sendAutoDelete(message.reply({ embeds: [embed] }), 6000);
    }
  },
};
