const { WebhookClient, EmbedBuilder } = require('discord.js');
const config = require('../config');
const logger = require('../logger/logger');

let botClient = null;

// Cache WebhookClient instances
const clients = {
  system: null,
  invite: null,
  command: null,
  slash: null,
  music: null,
};

/**
 * Stores the global Discord Client reference for fetching bot username & avatar automatically
 */
function setClient(client) {
  if (client) {
    botClient = client;
  }
}

/**
 * Helper to get the bot's username dynamically
 */
function getBotName(clientOverride) {
  const targetClient = clientOverride || botClient;
  return targetClient?.user?.username || 'Bot';
}

/**
 * Helper to get the bot's avatar URL dynamically
 */
function getBotAvatar(clientOverride) {
  const targetClient = clientOverride || botClient;
  if (targetClient?.user && typeof targetClient.user.displayAvatarURL === 'function') {
    return targetClient.user.displayAvatarURL({ extension: 'png', size: 256 });
  }
  return undefined;
}

/**
 * Generates custom webhook username matching each log category using dynamic bot username
 */
function getWebhookUsername(category, clientOverride) {
  const botName = getBotName(clientOverride);
  switch (category) {
    case 'system':
      return `🤖 System Logs | ${botName}`;
    case 'invite':
      return `📥 Invite Logs | ${botName}`;
    case 'command':
      return `⚡ Command Logs | ${botName}`;
    case 'slash':
      return `🔷 Slash Logs | ${botName}`;
    case 'music':
      return `🎵 Music Logs | ${botName}`;
    default:
      return `${botName} Logger`;
  }
}

/**
 * Safely retrieves or creates a WebhookClient for a given category.
 * Returns null if URL is not configured or invalid.
 */
function getWebhookClient(category) {
  const url = config.webhooks?.[category];
  if (!url || typeof url !== 'string' || !url.startsWith('http')) {
    return null;
  }

  if (!clients[category]) {
    try {
      clients[category] = new WebhookClient({ url });
    } catch (err) {
      logger.warn(`[WebhookLogger] Invalid webhook URL for ${category}: ${err.message}`);
      return null;
    }
  }

  return clients[category];
}

/**
 * Safely sends an embed payload to a webhook category.
 */
async function sendPayload(category, embedData, options = {}) {
  try {
    const webhook = getWebhookClient(category);
    if (!webhook) return;

    const embed = new EmbedBuilder(embedData).setTimestamp();
    const payload = { embeds: [embed] };

    // Set custom Webhook Username dynamically using bot's username
    const username = options.username || getWebhookUsername(category, options.client);
    if (username) payload.username = username;

    // Set Bot Avatar URL for Webhook
    const avatarURL = options.avatarURL || getBotAvatar(options.client);
    if (avatarURL) payload.avatarURL = avatarURL;

    await webhook.send(payload);
  } catch (err) {
    logger.warn(`[WebhookLogger] Failed to send ${category} webhook: ${err.message}`);
  }
}

/**
 * Helper to format duration in milliseconds to MM:SS or HH:MM:SS
 */
function formatDuration(ms) {
  if (!ms || isNaN(ms) || ms <= 0) return 'Live Stream / Unknown';
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

const WebhookLogger = {
  setClient,

  /**
   * 1. SYSTEM LOGS (Startup, Shard, Lavalink, Error)
   */
  async sendSystemLog({ title, description, level = 'info', fields = [], client = null }) {
    if (client) setClient(client);

    const colorMap = {
      info: 0x5865F2, // Blurple
      success: 0x57F287, // Green
      warn: 0xFEE75C, // Yellow
      error: 0xED4245, // Red
    };

    const embed = {
      title: title || '🖥️ System Log',
      description: description || '',
      color: colorMap[level] || colorMap.info,
      fields: [
        ...fields,
        { name: '🌐 Environment', value: `\`${config.app.env || 'production'}\``, inline: true },
      ],
      footer: { text: 'Bot System Monitor' },
    };

    await sendPayload('system', embed, {
      client,
      username: getWebhookUsername('system', client),
    });
  },

  /**
   * 2. INVITE LOGS (Bot Guild Join / Leave)
   */
  async sendInviteLog({ event, guild, client }) {
    if (!guild) return;
    if (client) setClient(client);

    const isJoin = event === 'GUILD_JOIN' || event === 'guildCreate';
    const totalGuilds = client?.guilds?.cache?.size || 'N/A';
    const iconUrl = typeof guild.iconURL === 'function' ? guild.iconURL({ extension: 'png', size: 128 }) : null;

    let ownerText = 'Unknown Owner';
    try {
      if (guild.ownerId) {
        ownerText = `<@${guild.ownerId}> (\`${guild.ownerId}\`)`;
      }
    } catch (e) { }

    const embed = {
      title: isJoin ? '📥 Joined New Server!' : '📤 Left a Server',
      color: isJoin ? 0x57F287 : 0xED4245,
      thumbnail: iconUrl ? { url: iconUrl } : undefined,
      fields: [
        { name: '🏰 Guild Name', value: `**${guild.name}**`, inline: true },
        { name: '🆔 Guild ID', value: `\`${guild.id}\``, inline: true },
        { name: '👥 Member Count', value: `\`${guild.memberCount || 'Unknown'}\` members`, inline: true },
        { name: '👑 Owner', value: ownerText, inline: true },
        { name: '📊 Total Servers Now', value: `\`${totalGuilds}\` servers`, inline: true },
      ],
      footer: { text: isJoin ? 'Guild Joined Log' : 'Guild Left Log' },
    };

    await sendPayload('invite', embed, {
      client,
      username: getWebhookUsername('invite', client),
    });
  },

  /**
   * 3. COMMAND LOGS (Prefix Command Executions)
   */
  async sendCommandLog({ commandName, user, guild, channel, argsString, prefix = '*', client = null }) {
    if (!commandName || !user) return;
    if (client) setClient(client);

    const displayName = user.nickname || user.displayName || user.globalName || user.username || user.user?.username || 'Unknown';
    const userId = user.id || user.user?.id || 'Unknown';

    const embed = {
      title: `⚡ Prefix Command: \`${prefix}${commandName}\``,
      color: 0x5865F2,
      fields: [
        { name: '👤 User', value: `**${displayName}** (<@${userId}>)\nID: \`${userId}\``, inline: true },
        { name: '🏰 Server', value: guild ? `**${guild.name}**\nID: \`${guild.id}\`` : 'Direct Message (DM)', inline: true },
        { name: '💬 Channel', value: channel ? `#${channel.name}\nID: \`${channel.id}\`` : 'DM Channel', inline: true },
        { name: '📝 Full Input', value: `\`\`\`${prefix}${commandName} ${argsString || ''}\`\`\``.slice(0, 1024), inline: false },
      ],
      footer: { text: 'Prefix Command Audit Log' },
    };

    await sendPayload('command', embed, {
      client,
      username: getWebhookUsername('command', client),
    });
  },

  /**
   * 3b. SLASH COMMAND LOGS (Slash Command Executions)
   */
  async sendSlashCommandLog({ commandName, subcommand, user, guild, channel, options = {}, client = null }) {
    if (!commandName || !user) return;
    if (client) setClient(client);

    const displayName = user.nickname || user.displayName || user.globalName || user.username || 'Unknown';
    const userId = user.id || 'Unknown';

    // Format options as key: value pairs
    const optionsText = Object.keys(options).length > 0
      ? Object.entries(options).map(([k, v]) => `${k}: ${v}`).join('\n')
      : 'No options';

    const fullCmd = subcommand ? `/${commandName} ${subcommand}` : `/${commandName}`;

    const embed = {
      title: `🔷 Slash Command: \`${fullCmd}\``,
      color: 0x57F287,
      fields: [
        { name: '👤 User', value: `**${displayName}** (<@${userId}>)\nID: \`${userId}\``, inline: true },
        { name: '🏰 Server', value: guild ? `**${guild.name}**\nID: \`${guild.id}\`` : 'Direct Message (DM)', inline: true },
        { name: '💬 Channel', value: channel ? `#${channel.name}\nID: \`${channel.id}\`` : 'DM Channel', inline: true },
        { name: '📋 Options', value: `\`\`\`${optionsText}\`\`\``.slice(0, 1024), inline: false },
      ],
      footer: { text: 'Slash Command Audit Log' },
    };

    await sendPayload('command', embed, {
      client,
      username: getWebhookUsername('slash', client),
    });
  },

  /**
   * 4. MUSIC PLAY LOGS (Track Start, Queue, Exception)
   */
  async sendMusicLog({ event, player, track, requester, error, client = null }) {
    if (!player || !track) return;
    if (client) setClient(client);

    const guildName = player.guildName || `Guild ${player.guildId}`;
    const voiceChannelId = player.voiceChannelId;
    const node = player.node?.id || 'DefaultNode';
    const requesterName = requester ? (requester.nickname || requester.displayName || requester.username) : 'Unknown';
    const requesterId = requester ? requester.id : (track.userData?.requesterId || 'Unknown');

    const titleStr = track.info?.title || 'Unknown Title';
    const authorStr = track.info?.author || 'Unknown Artist';
    const trackUrl = track.info?.uri && track.info.uri.startsWith('http') ? track.info.uri : null;
    const durationStr = formatDuration(track.info?.duration);
    const artworkUrl = track.info?.artworkUrl || track.info?.thumbnail || null;

    if (event === 'TRACK_START') {
      const embed = {
        title: `🎵 Now Playing: ${titleStr}`,
        url: trackUrl || undefined,
        color: 0xEB459E,
        thumbnail: artworkUrl ? { url: artworkUrl } : undefined,
        fields: [
          { name: '🎤 Artist / Author', value: authorStr, inline: true },
          { name: '⏱ Duration', value: durationStr, inline: true },
          { name: '👤 Requested By', value: `**${requesterName}** (<@${requesterId}>)`, inline: true },
          { name: '🏰 Server', value: `**${guildName}** (\`${player.guildId}\`)`, inline: true },
          { name: '🔊 Voice Channel', value: voiceChannelId ? `<#${voiceChannelId}>` : 'Unknown', inline: true },
          { name: '🌐 Lavalink Node', value: `\`${node}\``, inline: true },
        ],
        footer: { text: 'Music Play Lifecycle Log' },
      };

      await sendPayload('music', embed, {
        client,
        username: getWebhookUsername('music', client),
      });
    } else if (event === 'TRACK_ERROR') {
      const embed = {
        title: `⚠️ Music Playback Error: ${titleStr}`,
        description: `**Error Details:** ${error?.message || 'Unknown stream error'}`,
        color: 0xED4245,
        fields: [
          { name: '🏰 Server', value: `**${guildName}** (\`${player.guildId}\`)`, inline: true },
          { name: '🌐 Node', value: `\`${node}\``, inline: true },
        ],
        footer: { text: 'Music Error Log' },
      };

      await sendPayload('music', embed, {
        client,
        username: getWebhookUsername('music', client),
      });
    }
  },
};

module.exports = WebhookLogger;
