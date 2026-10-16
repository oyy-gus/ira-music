const { EmbedBuilder } = require('discord.js');
const { exec } = require('child_process');
const { getEmoji } = require('../../config/emojis');

module.exports = {
  name: 'exec',
  description: 'Execute a shell command on the host system',
  aliases: ['sh', 'shell', 'bash'],
  category: 'developer',
  ownerOnly: true,
  cooldown: 0,
  async execute({ message, rawArgsString, client }) {
    const emoji = (key) => {
      const e = getEmoji(key, client);
      return e ? `${e} ` : '';
    };

    if (!rawArgsString) {
      const embed = new EmbedBuilder()
        .setTitle(`${emoji('error')}Missing Argument`)
        .setDescription('Please provide a shell command to execute.')
        .setColor(0xED4245);
      return message.reply({ embeds: [embed] });
    }

    const loadingEmbed = new EmbedBuilder()
      .setTitle(`${emoji('loading')}Executing Command...`)
      .setDescription(`\`\`\`\n${rawArgsString}\n\`\`\``)
      .setColor(0x5865F2);

    const reply = await message.reply({ embeds: [loadingEmbed] });

    return new Promise((resolve) => {
      exec(rawArgsString, { timeout: 30000, maxBuffer: 1024 * 1024 }, (error, stdout, stderr) => {
        let output = '';
        if (stdout) output += stdout;
        if (stderr) output += `\n[STDERR]\n${stderr}`;
        if (error && !stderr) output += `\n[ERROR]\n${error.message}`;

        if (!output.trim()) output = '(no output)';

        // Truncate if too long for embed field (max 1024 chars in field value)
        if (output.length > 950) {
          output = output.substring(0, 950) + '\n... (truncated)';
        }

        const embed = new EmbedBuilder()
          .setTitle(error ? `${emoji('warning')}Command Completed with Errors` : `${emoji('success')}Command Executed`)
          .addFields(
            { name: `${emoji('input')}Command`, value: `\`\`\`\n${rawArgsString.substring(0, 500)}\n\`\`\`` },
            { name: `${emoji('output')}Output`, value: `\`\`\`\n${output}\n\`\`\`` }
          )
          .setColor(error ? 0xFEE75C : 0x57F287)
          .setTimestamp();

        reply.edit({ embeds: [embed] }).then(resolve).catch(resolve);
      });
    });
  },
};
