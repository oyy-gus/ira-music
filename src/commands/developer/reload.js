const { EmbedBuilder } = require('discord.js');
const { loadCommands } = require('../../handlers/commandHandler');
const logger = require('../../logger/logger');
const { getEmoji } = require('../../config/emojis');

module.exports = {
  name: 'reload',
  description: 'Reload a specific command or all commands without restarting',
  aliases: ['rl'],
  category: 'developer',
  ownerOnly: true,
  cooldown: 0,
  async execute({ message, args, client, prefix }) {
    const startTime = Date.now();

    const emoji = (key) => {
      const e = getEmoji(key, client);
      return e ? `${e} ` : '';
    };

    if (!args.length || args[0].toLowerCase() === 'all') {
      // Reload all commands
      try {
        loadCommands(client);
        const elapsed = Date.now() - startTime;

        const embed = new EmbedBuilder()
          .setTitle(`${emoji('reconnect')}All Commands Reloaded`)
          .setDescription(`Successfully reloaded **${client.commands.size}** commands in \`${elapsed}ms\`.`)
          .setColor(0x57F287)
          .setTimestamp();
        return message.reply({ embeds: [embed] });
      } catch (err) {
        const embed = new EmbedBuilder()
          .setTitle(`${emoji('error')}Reload Failed`)
          .setDescription(`\`\`\`\n${err.message}\n\`\`\``)
          .setColor(0xED4245);
        return message.reply({ embeds: [embed] });
      }
    }

    // Reload a specific command
    const searchName = args[0].toLowerCase();
    const commandName = client.aliases.get(searchName) || searchName;
    const command = client.commands.get(commandName);

    if (!command) {
      const embed = new EmbedBuilder()
        .setTitle(`${emoji('error')}Command Not Found`)
        .setDescription(`Command \`${args[0]}\` does not exist.`)
        .setColor(0xED4245);
      return message.reply({ embeds: [embed] });
    }

    try {
      const path = require('path');
      const fs = require('fs');
      const commandsDir = path.join(__dirname, '..');

      // Find the command file
      let filePath = null;
      const categories = fs.readdirSync(commandsDir);
      for (const category of categories) {
        const categoryPath = path.join(commandsDir, category);
        if (!fs.statSync(categoryPath).isDirectory()) continue;
        const files = fs.readdirSync(categoryPath);
        for (const file of files) {
          if (file === `${command.name}.js`) {
            filePath = path.join(categoryPath, file);
            break;
          }
        }
        if (filePath) break;
      }

      if (!filePath) {
        const embed = new EmbedBuilder()
          .setTitle(`${emoji('error')}File Not Found`)
          .setDescription(`Could not locate the file for command \`${command.name}\`.`)
          .setColor(0xED4245);
        return message.reply({ embeds: [embed] });
      }

      // Clear require cache and re-require
      delete require.cache[require.resolve(filePath)];
      const newCommand = require(filePath);
      newCommand.category = command.category;
      client.commands.set(newCommand.name.toLowerCase(), newCommand);

      // Rebuild aliases
      if (command.aliases) {
        for (const alias of command.aliases) {
          client.aliases.delete(alias.toLowerCase());
        }
      }
      if (newCommand.aliases && Array.isArray(newCommand.aliases)) {
        for (const alias of newCommand.aliases) {
          client.aliases.set(alias.toLowerCase(), newCommand.name.toLowerCase());
        }
      }

      const elapsed = Date.now() - startTime;
      const embed = new EmbedBuilder()
        .setTitle(`${emoji('reconnect')}Command Reloaded`)
        .setDescription(`Successfully reloaded \`${prefix}${newCommand.name}\` in \`${elapsed}ms\`.`)
        .setColor(0x57F287)
        .setTimestamp();
      return message.reply({ embeds: [embed] });
    } catch (err) {
      logger.error(`[Reload] Failed to reload command ${commandName}: ${err.message}`);
      const embed = new EmbedBuilder()
        .setTitle(`${emoji('error')}Reload Failed`)
        .setDescription(`\`\`\`\n${err.message}\n\`\`\``)
        .setColor(0xED4245);
      return message.reply({ embeds: [embed] });
    }
  },
};
