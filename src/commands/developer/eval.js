const { EmbedBuilder } = require('discord.js');
const logger = require('../../logger/logger');
const { inspect } = require('util');
const { getEmoji } = require('../../config/emojis');

module.exports = {
  name: 'eval',
  description: 'Evaluate JavaScript code at runtime',
  aliases: ['ev'],
  category: 'developer',
  ownerOnly: true,
  cooldown: 0,
  async execute({ message, args, rawArgsString, client }) {
    if (!rawArgsString) {
      const embed = new EmbedBuilder()
        .setTitle(`${getEmoji('error', client)} Missing Argument`)
        .setDescription('Please provide JavaScript code to evaluate.')
        .setColor(0xED4245);
      return message.reply({ embeds: [embed] });
    }

    const startTime = process.hrtime.bigint();

    let result;
    let isError = false;
    try {
      // Make useful variables available in eval scope
      const config = require('../../config');
      const db = require('../../database/connection');

      result = eval(rawArgsString);

      // Await if the result is a promise
      if (result instanceof Promise) {
        result = await result;
      }
    } catch (err) {
      result = err;
      isError = true;
    }

    const endTime = process.hrtime.bigint();
    const executionTimeMs = Number(endTime - startTime) / 1e6;

    // Format the output
    let output = typeof result === 'string' ? result : inspect(result, { depth: 2 });

    // Sanitize sensitive data from output
    const config = require('../../config');
    const sensitivePatterns = [
      config.discord.token,
      config.database.uri,
    ].filter(Boolean);

    for (const pattern of sensitivePatterns) {
      if (pattern && output.includes(pattern)) {
        output = output.replaceAll(pattern, '********');
      }
    }

    if (!output || !output.trim()) {
      output = '(no output)';
    }

    // Truncate if too long for embed field (max 1024 chars in field value)
    if (output.length > 950) {
      output = output.substring(0, 950) + '\n... (truncated)';
    }

    const emoji = (key) => {
      const e = getEmoji(key, client);
      return e ? `${e} ` : '';
    };

    const embed = new EmbedBuilder()
      .setTitle(isError ? `${emoji('error')}Eval Error` : `${emoji('evalcode')}Eval Result`)
      .addFields(
        { name: `${emoji('input')}Input`, value: `\`\`\`js\n${rawArgsString.substring(0, 500)}\n\`\`\`` },
        { name: `${emoji('output')}Output`, value: `\`\`\`js\n${output}\n\`\`\`` },
        { name: `${emoji('time')}Execution Time`, value: `\`${executionTimeMs.toFixed(2)}ms\``, inline: true },
        { name: `${emoji('type')}Type`, value: `\`${typeof result}\``, inline: true }
      )
      .setColor(isError ? 0xED4245 : 0x57F287)
      .setTimestamp();

    return message.reply({ embeds: [embed] });
  },
};
