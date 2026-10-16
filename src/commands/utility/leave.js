'use strict';

const { EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const { getEmoji } = require('../../config/emojis');
const { getGreetingConfig, updateGreetingConfig, resetGreetingConfig, renderCard, checkChannelPermissions } = require('../../services/greetingService');

module.exports = {
  name: 'leave',
  description: 'Configure the Leave system for this server',
  aliases: ['setleave', 'leaveconfig', 'goodbye'],
  category: 'utility',
  cooldown: 3,
  userPermissions: [PermissionFlagsBits.ManageGuild],
  async execute({ message, args, prefix, client }) {
    const gEmoji = (key, fb = '') => { const e = getEmoji(key, fb, client); return e ? `${e} ` : ''; };
    const guildId = message.guild.id;
    const sub = (args[0] || '').toLowerCase();

    // ── No subcommand → show current config ──────────────────────────────────
    if (!sub) {
      const cfg = await getGreetingConfig(guildId);
      const l = cfg?.leave;
      const status = l?.enabled ? `${gEmoji('success', '✅')}Enabled` : `${gEmoji('error', '❌')}Disabled`;
      const channel = l?.channelId ? `<#${l.channelId}>` : 'Not set';
      const mode = l?.mode || 'standalone';

      const embed = new EmbedBuilder()
        .setTitle(`${gEmoji('settings', '⚙️')}Leave System — ${message.guild.name}`)
        .addFields(
          { name: 'Status', value: status, inline: true },
          { name: 'Mode', value: `\`${mode}\``, inline: true },
          { name: 'Channel', value: channel, inline: true },
          { name: 'Card Image', value: l?.useCard !== false ? 'On' : 'Off', inline: true },
          { name: 'Auto-Delete', value: l?.autoDeleteMs > 0 ? `${l.autoDeleteMs / 1000}s` : 'Off', inline: true },
          { name: 'Message', value: `\`\`\`${l?.message || 'Not configured'}\`\`\`` }
        )
        .setDescription(
          `**Subcommands:**\n` +
          `• \`${prefix}leave enable\` — Enable leave messages\n` +
          `• \`${prefix}leave disable\` — Disable leave messages\n` +
          `• \`${prefix}leave mode standalone|embed|text\` — Set delivery mode\n` +
          `• \`${prefix}leave channel #channel\` — Set leave channel\n` +
          `• \`${prefix}leave message <text>\` — Set leave message\n` +
          `• \`${prefix}leave card on|off\` — Toggle leave card image\n` +
          `• \`${prefix}leave embedtitle <text>\` — Set custom embed title\n` +
          `• \`${prefix}leave embeddesc <text>\` — Set custom embed description\n` +
          `• \`${prefix}leave embedcolor #hex\` — Set custom embed color\n` +
          `• \`${prefix}leave preview\` — Preview the leave card\n` +
          `• \`${prefix}leave reset\` — Reset to defaults\n\n` +
          `**Placeholders:** \`{user}\` \`{username}\` \`{displayName}\` \`{server}\` \`{memberCount}\` \`{userId}\``
        )
        .setColor(0xED4245);
      return message.reply({ embeds: [embed] });
    }

    if (sub === 'enable') {
      await updateGreetingConfig(guildId, 'leave', { enabled: true });
      const embed = new EmbedBuilder()
        .setTitle(`${gEmoji('success', '✅')}Leave Enabled`)
        .setDescription('Leave messages are now **enabled**.')
        .setColor(0x57F287);
      return message.reply({ embeds: [embed] });
    }

    if (sub === 'disable') {
      await updateGreetingConfig(guildId, 'leave', { enabled: false });
      const embed = new EmbedBuilder()
        .setTitle(`${gEmoji('success', '✅')}Leave Disabled`)
        .setDescription('Leave messages are now **disabled**.')
        .setColor(0xED4245);
      return message.reply({ embeds: [embed] });
    }

    if (sub === 'mode') {
      const mode = (args[1] || '').toLowerCase();
      if (!['standalone', 'embed', 'text'].includes(mode)) {
        const embed = new EmbedBuilder().setTitle(`${gEmoji('error', '❌')}Invalid Mode`).setDescription('Valid modes: `standalone`, `embed`, `text`').setColor(0xED4245);
        return message.reply({ embeds: [embed] });
      }
      await updateGreetingConfig(guildId, 'leave', { mode });
      const embed = new EmbedBuilder().setTitle(`${gEmoji('success', '✅')}Leave Mode Set`).setDescription(`Mode set to **${mode}**.`).setColor(0x57F287);
      return message.reply({ embeds: [embed] });
    }

    if (sub === 'channel') {
      const channel = message.mentions.channels.first() || message.guild.channels.cache.get(args[1]);
      if (!channel || !channel.isTextBased()) {
        const embed = new EmbedBuilder().setTitle(`${gEmoji('error', '❌')}Invalid Channel`).setDescription('Please mention a valid text channel.').setColor(0xED4245);
        return message.reply({ embeds: [embed] });
      }

      const cfg = await getGreetingConfig(guildId);
      const permCheck = checkChannelPermissions(channel, message.guild, cfg?.leave?.mode || 'standalone', cfg?.leave?.useCard !== false);

      if (!permCheck.ok) {
        const embed = new EmbedBuilder()
          .setTitle(`${gEmoji('error', '⚠️')}Missing Permissions in ${channel}`)
          .setDescription(`Missing: \`${permCheck.missing.join('`, `')}\``)
          .setColor(0xED4245);
        return message.reply({ embeds: [embed] });
      }

      await updateGreetingConfig(guildId, 'leave', { channelId: channel.id });
      const embed = new EmbedBuilder().setTitle(`${gEmoji('success', '✅')}Leave Channel Set`).setDescription(`Leave messages will be sent to ${channel}.`).setColor(0x57F287);
      return message.reply({ embeds: [embed] });
    }

    if (sub === 'message') {
      const text = args.slice(1).join(' ').trim();
      if (!text || text.length < 1 || text.length > 1000) {
        const embed = new EmbedBuilder().setTitle(`${gEmoji('error', '❌')}Invalid Message`).setDescription('Please provide a message (1–1000 characters).').setColor(0xED4245);
        return message.reply({ embeds: [embed] });
      }
      await updateGreetingConfig(guildId, 'leave', { message: text });
      const embed = new EmbedBuilder().setTitle(`${gEmoji('success', '✅')}Leave Message Set`).addFields({ name: 'New Message', value: `\`\`\`${text}\`\`\`` }).setColor(0x57F287);
      return message.reply({ embeds: [embed] });
    }

    if (sub === 'embedtitle') {
      const text = args.slice(1).join(' ').trim();
      await updateGreetingConfig(guildId, 'leave', { 'embedConfig.title': text });
      const embed = new EmbedBuilder().setTitle(`${gEmoji('success', '✅')}Embed Title Set`).setDescription(`Title: \`${text}\``).setColor(0x57F287);
      return message.reply({ embeds: [embed] });
    }

    if (sub === 'embeddesc') {
      const text = args.slice(1).join(' ').trim();
      await updateGreetingConfig(guildId, 'leave', { 'embedConfig.description': text });
      const embed = new EmbedBuilder().setTitle(`${gEmoji('success', '✅')}Embed Description Set`).setDescription(`Description: \`\`\`${text}\`\`\``).setColor(0x57F287);
      return message.reply({ embeds: [embed] });
    }

    if (sub === 'embedcolor') {
      const hex = (args[1] || '').trim();
      await updateGreetingConfig(guildId, 'leave', { 'embedConfig.color': hex });
      const embed = new EmbedBuilder().setTitle(`${gEmoji('success', '✅')}Embed Color Set`).setDescription(`Color: \`${hex}\``).setColor(0x57F287);
      return message.reply({ embeds: [embed] });
    }

    if (sub === 'card') {
      const toggle = (args[1] || '').toLowerCase();
      await updateGreetingConfig(guildId, 'leave', { useCard: toggle === 'on' });
      const embed = new EmbedBuilder().setTitle(`${gEmoji('success', '✅')}Leave Card ${toggle === 'on' ? 'Enabled' : 'Disabled'}`).setColor(0x57F287);
      return message.reply({ embeds: [embed] });
    }

    if (sub === 'preview') {
      const loadingMsg = await message.reply({ content: '🎨 Generating preview...' });
      try {
        const cfg = await getGreetingConfig(guildId);
        const imgBuffer = await renderCard({
          type: 'leave',
          displayName: message.author.displayName || message.author.username,
          username: message.author.username,
          avatarUrl: message.author.displayAvatarURL({ extension: 'png', size: 256, forceStatic: true }),
          guildName: message.guild.name,
          memberCount: message.guild.memberCount,
          cardConfig: cfg?.leave?.card || {},
        });
        if (!imgBuffer) {
          await loadingMsg.edit({ content: '⚠️ Canvas renderer is not available.' });
          return;
        }
        await loadingMsg.edit({ content: '**Leave Preview:**', files: [{ attachment: imgBuffer, name: 'leave-preview.png' }] });
      } catch (err) {
        await loadingMsg.edit({ content: `❌ Preview failed: ${err.message}` });
      }
      return;
    }

    if (sub === 'reset') {
      await resetGreetingConfig(guildId, 'leave');
      const embed = new EmbedBuilder().setTitle(`${gEmoji('success', '✅')}Leave Reset`).setDescription('Leave configuration has been reset to defaults.').setColor(0x57F287);
      return message.reply({ embeds: [embed] });
    }

    const embed = new EmbedBuilder().setTitle(`${gEmoji('error', '❌')}Unknown Subcommand`).setDescription(`Use \`${prefix}leave\` to see all available options.`).setColor(0xED4245);
    return message.reply({ embeds: [embed] });
  },
};
