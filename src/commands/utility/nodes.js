const { EmbedBuilder } = require('discord.js');
const { NodeHealthMonitor } = require('../../music/failover/NodeHealthMonitor');
const RecoveryMetrics = require('../../music/failover/RecoveryMetrics');
const { getEmoji } = require('../../config/emojis');

module.exports = {
  name: 'nodes',
  description: 'View Lavalink cluster health, node statuses, and failover statistics',
  aliases: ['lavalink', 'cluster', 'nodeinfo'],
  category: 'utility',
  cooldown: 3,
  async execute({ message, client }) {
    const emoji = (key) => {
      const e = getEmoji(key, client);
      return e ? `${e} ` : '';
    };

    const nodeStats = NodeHealthMonitor.getAllNodeStats();
    const metrics = RecoveryMetrics.getMetricsSummary();

    const embed = new EmbedBuilder()
      .setTitle(`${emoji('lavalink')}Lavalink Cluster Health & Failover Status`)
      .setColor(0x5865F2)
      .setTimestamp();

    if (nodeStats.length === 0) {
      embed.setDescription(`${emoji('warning')}No Lavalink nodes registered or monitored yet.`);
    } else {
      let nodesField = '';
      for (const node of nodeStats) {
        let statusEmoji = emoji('disconnect');
        if (node.status === 'HEALTHY') statusEmoji = emoji('connected') || emoji('success');
        else if (node.status === 'DEGRADED') statusEmoji = emoji('warning');
        else if (node.status === 'RECOVERING') statusEmoji = emoji('reconnect');

        nodesField += `**${statusEmoji}${node.nodeId}** (${node.region})\n`;
        nodesField += `• **Status:** \`${node.status}\` | **Latency:** \`${node.latency}ms\`\n`;
        nodesField += `• **Players:** \`${node.playingPlayers}/${node.players}\` | **CPU:** \`${node.cpu?.lavalink || 0}%\`\n`;
        nodesField += `• **RAM:** \`${node.memory?.used || 0}MB / ${node.memory?.allocated || 0}MB\` | **Stability:** \`${node.connectionStability}%\`\n\n`;
      }

      embed.addFields(
        { name: `${emoji('cluster')}Cluster Nodes`, value: nodesField.trim() || 'No data', inline: false },
        {
          name: `${emoji('recovery')}Failover & Recovery Metrics`,
          value: [
            `• **Failovers Triggered:** \`${metrics.lavalink_failovers_total}\``,
            `• **Player Migrations:** \`${metrics.player_migrations_total}\` (Failures: \`${metrics.player_migration_failures_total}\`)`,
            `• **Startup Recoveries:** \`${metrics.player_recovery_total}\` (Failures: \`${metrics.player_recovery_failures_total}\`)`,
            `• **Playback Resumes:** \`${metrics.playback_resume_total}\``,
            `• **Avg Migration Time:** \`${metrics.average_migration_duration_ms}ms\``,
            `• **Avg Recovery Time:** \`${metrics.average_recovery_duration_ms}ms\``,
          ].join('\n'),
          inline: false,
        }
      );
    }

    return message.reply({ embeds: [embed] });
  },
};
