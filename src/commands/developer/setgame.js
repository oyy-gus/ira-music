const { EmbedBuilder, ActivityType } = require('discord.js');
const { getEmoji } = require('../../config/emojis');

module.exports = {
  name: 'setgame',
  description: 'Change bot presence activity and status',
  aliases: ['setactivity', 'presence', 'setstatus'],
  category: 'developer',
  ownerOnly: true,
  cooldown: 0,
  async execute({ message, args, rawArgsString, client, prefix }) {
    const emoji = (key) => {
      const e = getEmoji(key, client);
      return e ? `${e} ` : '';
    };

    if (!args.length) {
      const embed = new EmbedBuilder()
        .setTitle(`${emoji('settings')}Set Game / Activity`)
        .setDescription(`Usage: \`${prefix}setgame <type> <text>\`\nTypes: \`playing\`, \`listening\`, \`watching\`, \`competing\`, \`streaming\`, \`reset\``)
        .setColor(0x5865F2);
      return message.reply({ embeds: [embed] });
    }

    const typeArg = args[0].toLowerCase();
    if (typeArg === 'reset') {
      client.user.setActivity();
      client.user.setStatus('online');
      const embed = new EmbedBuilder()
        .setTitle(`${emoji('reconnect')}Activity Reset`)
        .setDescription('Bot status and activity have been reset to default.')
        .setColor(0x57F287);
      return message.reply({ embeds: [embed] });
    }

    const activityName = args.slice(1).join(' ');
    if (!activityName) {
      return message.reply(`${emoji('error')}Please provide text for the activity status.`);
    }

    let activityType;
    switch (typeArg) {
      case 'playing':
      case 'play':
        activityType = ActivityType.Playing;
        break;
      case 'listening':
      case 'listen':
        activityType = ActivityType.Listening;
        break;
      case 'watching':
      case 'watch':
        activityType = ActivityType.Watching;
        break;
      case 'competing':
      case 'compete':
        activityType = ActivityType.Competing;
        break;
      case 'streaming':
      case 'stream':
        activityType = ActivityType.Streaming;
        break;
      default:
        return message.reply(`${emoji('error')}Invalid type! Choose from: \`playing\`, \`listening\`, \`watching\`, \`competing\`, \`streaming\`, \`reset\`.`);
    }

    client.user.setPresence({
      activities: [{ name: activityName, type: activityType }],
      status: 'online',
    });

    const embed = new EmbedBuilder()
      .setTitle(`${emoji('success')}Activity Updated`)
      .setDescription(`Updated status to: **${typeArg.toUpperCase()} ${activityName}**`)
      .setColor(0x57F287);
    return message.reply({ embeds: [embed] });
  },
};
