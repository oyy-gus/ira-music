const { EmbedBuilder } = require('discord.js');
const { getEmoji } = require('../../config/emojis');

module.exports = {
  name: 'help',
  description: 'Display all available commands or details of a specific command',
  aliases: ['h', 'commands'],
  category: 'utility',
  cooldown: 3,
  async execute({ message, args, client, prefix }) {
    const emoji = (key) => {
      const e = getEmoji(key, client);
      return e ? `${e} ` : '';
    };

    if (args.length > 0) {
      const searchName = args[0].toLowerCase();
      const commandName = client.aliases.get(searchName) || searchName;
      const command = client.commands.get(commandName);

      if (!command || command.ownerOnly || command.category === 'developer') {
        return message.reply(`${emoji('error')}Command \`${args[0]}\` not found.`);
      }

      const embed = new EmbedBuilder()
        .setTitle(`${emoji('command')}Command Detail: ${prefix}${command.name}`)
        .setColor(0x5865F2)
        .addFields(
          { name: 'Description', value: command.description || 'No description available.' },
          { name: 'Aliases', value: command.aliases ? command.aliases.map(a => `\`${prefix}${a}\``).join(', ') : 'None' },
          { name: 'Category', value: command.category || 'General', inline: true },
          { name: 'Cooldown', value: `${command.cooldown || 3} seconds`, inline: true }
        )
        .setFooter({ text: 'Prefix Command Engine' });

      return message.reply({ embeds: [embed] });
    }

    const categories = {};
    for (const [, command] of client.commands) {
      if (command.ownerOnly || command.category === 'developer') continue;
      const category = command.category || 'General';
      if (!categories[category]) categories[category] = [];
      categories[category].push(command.name);
    }

    const embed = new EmbedBuilder()
      .setTitle(`${emoji('command')}Command List`)
      .setDescription(`Default Prefix: \`${prefix}\`\nUse \`${prefix}help <command>\` for detailed information on a command.`)
      .setColor(0x5865F2);

    for (const [cat, cmds] of Object.entries(categories)) {
      const catKey = cat.toLowerCase();
      embed.addFields({
        name: `${emoji(catKey) || emoji('folder')}${cat.toUpperCase()}`,
        value: cmds.map(c => `\`${prefix}${c}\``).join(', '),
      });
    }

    return message.reply({ embeds: [embed] });
  },
};


