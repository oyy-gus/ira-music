const fs = require('fs');
const path = require('path');
const logger = require('../logger/logger');

const parseArguments = (rawArgsString) => {
  if (!rawArgsString) return [];
  // Regex to match quoted strings ("...") or non-whitespace sequences
  const regex = /"([^"\\]*(?:\\.[^"\\]*)*)"|'([^'\\]*(?:\\.[^'\\]*)*)'|(\S+)/g;
  const args = [];
  let match;
  while ((match = regex.exec(rawArgsString)) !== null) {
    // Group 1: double quotes, Group 2: single quotes, Group 3: unquoted
    args.push(match[1] || match[2] || match[3]);
  }
  return args;
};

const loadCommands = (client) => {
  client.commands = new Map();
  client.aliases = new Map();
  client.cooldowns = new Map();

  const commandsDir = path.join(__dirname, '../commands');

  if (!fs.existsSync(commandsDir)) {
    logger.warn(`Commands directory not found at ${commandsDir}`);
    return;
  }

  const categories = fs.readdirSync(commandsDir);

  let totalCommands = 0;

  for (const category of categories) {
    const categoryPath = path.join(commandsDir, category);
    if (!fs.statSync(categoryPath).isDirectory()) continue;

    const commandFiles = fs.readdirSync(categoryPath).filter(file => file.endsWith('.js'));

    for (const file of commandFiles) {
      const filePath = path.join(categoryPath, file);
      try {
        delete require.cache[require.resolve(filePath)];
        const command = require(filePath);

        if (!command.name) {
          logger.warn(`Command at ${filePath} missing a 'name' property.`);
          continue;
        }

        command.category = category;
        client.commands.set(command.name.toLowerCase(), command);
        totalCommands++;

        if (command.aliases && Array.isArray(command.aliases)) {
          for (const alias of command.aliases) {
            const cleanAlias = alias.toLowerCase();
            if (client.commands.has(cleanAlias)) {
              logger.warn(`[CommandHandler] Alias '${cleanAlias}' for '${command.name}' conflicts with existing command '${cleanAlias}'. Skipped.`);
              continue;
            }
            if (client.aliases.has(cleanAlias)) {
              logger.warn(`[CommandHandler] Alias '${cleanAlias}' for '${command.name}' conflicts with alias for '${client.aliases.get(cleanAlias)}'. Skipped.`);
              continue;
            }
            client.aliases.set(cleanAlias, command.name.toLowerCase());
          }
        }

        logger.debug(`Loaded command: ${command.name} [Category: ${category}]`);
      } catch (error) {
        logger.error(`Failed to load command at ${filePath}`, { error: error.message });
      }
    }
  }

  logger.info(`Successfully loaded ${totalCommands} commands across ${categories.length} categories.`);
};

module.exports = {
  loadCommands,
  parseArguments,
};
