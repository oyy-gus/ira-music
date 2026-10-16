'use strict';

const { EmbedBuilder } = require('discord.js');
const atlantisService = require('../../services/atlantis/atlantisService');

module.exports = {
  name: 'owotop',
  description: 'View the weekly OwO leaderboard for this server or globally',
  aliases: ['otop', 'owoleaderboard', 'topowo'],
  category: 'utility',
  cooldown: 5,
  async execute({ message, args, prefix = '*' }) {
    const isGlobal = args && args[0] && (args[0].toLowerCase() === 'global' || args[0].toLowerCase() === 'g');
    const guildId = isGlobal ? null : message.guild?.id;

    const { aotw, members } = await atlantisService.getMembersLeaderboard(guildId);
    const combined = [...(aotw || []), ...(members || [])].slice(0, 10);

    const embed = new EmbedBuilder()
      .setColor(0x8B5CF6)
      .setTimestamp();

    if (isGlobal) {
      embed.setTitle('🌐 Global OwO Leaderboard (All Servers)');
      embed.setDescription(
        `Top community players across all servers this week.\n` +
        `Use \`${prefix}owotop\` to view stats for **${message.guild?.name || 'this server'}**.\n\n`
      );
    } else {
      embed.setTitle(`🏰 Weekly OwO Leaderboard — ${message.guild?.name || 'This Server'}`);
      embed.setThumbnail(message.guild?.iconURL({ extension: 'png' }) || null);
      embed.setDescription(
        `Active members who typed \`owo\` or \`uwu\` in this server this week.\n` +
        `Use \`${prefix}owotop global\` to view the global leaderboard.\n\n`
      );
    }

    if (combined.length === 0) {
      embed.setDescription(
        `${embed.data.description}*No weekly activity recorded yet. Start chatting and typing \`owo\`!*`
      );
      return message.reply({ embeds: [embed] });
    }

    const rankEmojis = ['🥇', '🥈', '🥉'];
    const lines = combined.map((m, idx) => {
      const rank = rankEmojis[idx] || `\`#${idx + 1}\``;
      const hit = (m.owosPastWeek || 0) >= 50 ? '✔️' : '❌';
      const name = m.nickname || m.userTag || `User ${m.userId}`;
      const serverInfo = isGlobal && m.serverCount && m.serverCount > 1
        ? ` *(active in ${m.serverCount} servers)*`
        : (isGlobal && m.guildName ? ` *(${m.guildName})*` : '');

      return `${rank} **${name}** — \`${m.owosPastWeek || 0} owos\` ${hit}${serverInfo}`;
    });

    embed.addFields({
      name: '🏆 Top Weekly Members (Requirement: 50 OwOs)',
      value: lines.join('\n'),
    });

    embed.setFooter({
      text: `Weekly requirement: 50 OwOs • Web Dashboard: /members${guildId ? `?guildId=${guildId}` : ''}`,
    });

    return message.reply({ embeds: [embed] });
  },
};
