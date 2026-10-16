const fs = require('fs');
const path = require('path');
const { REST, Routes, MessageFlags } = require('discord.js');
const config = require('../config');
const logger = require('../logger/logger');
const { getEmoji } = require('../config/emojis');
const WebhookLogger = require('../services/webhookLogger');

const cooldowns = new Map();

/**
 * Load all slash commands from src/slashCommands/music and src/slashCommands/utility
 */
const loadSlashCommands = (client) => {
  client.slashCommands = new Map();
  const slashDir = path.join(__dirname, '../slashCommands');

  if (!fs.existsSync(slashDir)) {
    fs.mkdirSync(slashDir, { recursive: true });
    fs.mkdirSync(path.join(slashDir, 'music'), { recursive: true });
    fs.mkdirSync(path.join(slashDir, 'utility'), { recursive: true });
  }

  const categories = ['music', 'utility'];
  let totalSlash = 0;

  for (const category of categories) {
    const catPath = path.join(slashDir, category);
    if (!fs.existsSync(catPath)) continue;

    const files = fs.readdirSync(catPath).filter((f) => f.endsWith('.js'));
    for (const file of files) {
      const filePath = path.join(catPath, file);
      try {
        delete require.cache[require.resolve(filePath)];
        const command = require(filePath);

        if (!command.data || !command.data.name) {
          logger.warn(`[SlashHandler] Command at ${filePath} is missing a valid 'data' property.`);
          continue;
        }

        command.category = category;
        client.slashCommands.set(command.data.name.toLowerCase(), command);
        totalSlash++;
        logger.debug(`[SlashHandler] Loaded slash command: /${command.data.name} [Category: ${category}]`);
      } catch (err) {
        logger.error(`[SlashHandler] Failed to load slash command at ${filePath}:`, { error: err.message });
      }
    }
  }

  logger.info(`[SlashHandler] Loaded ${totalSlash} global Slash Commands across categories: ${categories.join(', ')}.`);
};

/**
 * Register/Deploy Slash Commands to Discord API
 */
const deploySlashCommands = async (client) => {
  if (!client.slashCommands || client.slashCommands.size === 0) {
    loadSlashCommands(client);
  }

  const clientId = config.discord.clientId || client.user?.id;
  const token = config.discord.token;

  if (!clientId || !token) {
    logger.warn('[SlashHandler] Cannot deploy Slash Commands: clientId or token is missing.');
    return;
  }

  const commandsData = Array.from(client.slashCommands.values()).map((cmd) => cmd.data.toJSON());

  const rest = new REST({ version: '10' }).setToken(token);

  try {
    logger.info(`[SlashHandler] Registering ${commandsData.length} global Slash Commands with Discord API...`);
    await rest.put(Routes.applicationCommands(clientId), { body: commandsData });
    logger.info(`[SlashHandler] Successfully registered ${commandsData.length} global Slash Commands!`);
  } catch (error) {
    logger.error('[SlashHandler] ❌ Failed to register global Slash Commands:', { error: error.message });
  }
};

/**
 * Handle incoming chat input slash command interactions
 */
const handleSlashInteraction = async (interaction, client) => {
  if (!interaction.isChatInputCommand()) return;

  const command = client.slashCommands?.get(interaction.commandName);
  if (!command) {
    return interaction.reply({ content: '❌ Unknown or unregistered Slash Command.', flags: MessageFlags.Ephemeral }).catch(() => { });
  }

  // Cooldown check
  if (command.cooldown) {
    if (!cooldowns.has(command.data.name)) {
      cooldowns.set(command.data.name, new Map());
    }
    const now = Date.now();
    const timestamps = cooldowns.get(command.data.name);
    const cooldownAmount = (command.cooldown || 3) * 1000;

    if (timestamps.has(interaction.user.id)) {
      const expirationTime = timestamps.get(interaction.user.id) + cooldownAmount;
      if (now < expirationTime) {
        const timeLeft = ((expirationTime - now) / 1000).toFixed(1);
        const errEmoji = getEmoji('error', client) || '⏳';
        return interaction.reply({
          content: `${errEmoji} Please wait \`${timeLeft}s\` before reusing the \`/${command.data.name}\` command.`,
          flags: MessageFlags.Ephemeral,
        }).catch(() => { });
      }
    }
    timestamps.set(interaction.user.id, now);
    setTimeout(() => timestamps.delete(interaction.user.id), cooldownAmount);
  }

  try {
    await command.execute(interaction, client);

    // Log slash command execution to webhook
    const resolvedOptions = {};
    try {
      interaction.options?.data?.forEach((opt) => {
        resolvedOptions[opt.name] = opt.value ?? opt.options?.map(o => `${o.name}: ${o.value}`).join(', ') ?? '—';
      });
    } catch (_) {}

    WebhookLogger.sendSlashCommandLog({
      commandName: interaction.commandName,
      subcommand: interaction.options?.getSubcommand?.(false) || null,
      user: interaction.member || interaction.user,
      guild: interaction.guild,
      channel: interaction.channel,
      options: resolvedOptions,
      client,
    });
  } catch (error) {
    logger.error(`[SlashHandler] Error executing /${interaction.commandName}:`, { error: error.message, stack: error.stack });
    const errContent = '❌ An error occurred while executing this Slash Command.';
    if (interaction.deferred || interaction.replied) {
      await interaction.editReply({ content: errContent }).catch(() => { });
    } else {
      await interaction.reply({ content: errContent, flags: MessageFlags.Ephemeral }).catch(() => { });
    }
  }
};

module.exports = {
  loadSlashCommands,
  deploySlashCommands,
  handleSlashInteraction,
};
