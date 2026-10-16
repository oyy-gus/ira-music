'use strict';

const { EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const { getEmoji } = require('../../config/emojis');
const { getGreetingConfig, updateGreetingConfig, resetGreetingConfig, renderCard, checkChannelPermissions } = require('../../services/greetingService');

module.exports = {
  name: 'welcome',
  description: 'Configure the Welcome system for this server',
  aliases: ['setwelcome', 'welcomeconfig'],
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
      const w = cfg?.welcome;
      const status = w?.enabled ? `${gEmoji('success', '✅')}Enabled` : `${gEmoji('error', '❌')}Disabled`;
      const channel = w?.channelId ? `<#${w.channelId}>` : 'Not set';
      const mode = w?.mode || 'standalone';

      const embed = new EmbedBuilder()
        .setTitle(`${gEmoji('settings', '⚙️')}Welcome System — ${message.guild.name}`)
        .addFields(
          { name: 'Status', value: status, inline: true },
          { name: 'Mode', value: `\`${mode}\``, inline: true },
          { name: 'Channel', value: channel, inline: true },
          { name: 'Card Image', value: w?.useCard !== false ? 'On' : 'Off', inline: true },
          { name: 'DM Welcome', value: w?.dmEnabled ? 'On' : 'Off', inline: true },
          { name: 'Auto-Delete', value: w?.autoDeleteMs > 0 ? `${w.autoDeleteMs / 1000}s` : 'Off', inline: true },
          { name: 'Message', value: `\`\`\`${w?.message || 'Not configured'}\`\`\`` }
        )
        .setDescription(
          `**Subcommands:**\n` +
          `• \`${prefix}welcome enable\` — Enable welcome messages\n` +
          `• \`${prefix}welcome disable\` — Disable welcome messages\n` +
          `• \`${prefix}welcome mode standalone|embed|text\` — Set delivery mode\n` +
          `• \`${prefix}welcome channel #channel\` — Set welcome channel\n` +
          `• \`${prefix}welcome message <text>\` — Set welcome message\n` +
          `• \`${prefix}welcome card on|off\` — Toggle welcome card image\n` +
          `• \`${prefix}welcome embedtitle <text>\` — Set custom embed title\n` +
          `• \`${prefix}welcome embeddesc <text>\` — Set custom embed description\n` +
          `• \`${prefix}welcome embedcolor #hex\` — Set custom embed color\n` +
          `• \`${prefix}welcome preview\` — Preview the welcome card\n` +
          `• \`${prefix}welcome reset\` — Reset to defaults\n\n` +
          `**Placeholders:** \`{user}\` \`{username}\` \`{displayName}\` \`{server}\` \`{memberCount}\` \`{memberNumber}\` \`{userId}\``
        )
        .setColor(0x5865F2);
      return message.reply({ embeds: [embed] });
    }

    // ── enable ────────────────────────────────────────────────────────────────
    if (sub === 'enable') {
      await updateGreetingConfig(guildId, 'welcome', { enabled: true });
      const embed = new EmbedBuilder()
        .setTitle(`${gEmoji('success', '✅')}Welcome Enabled`)
        .setDescription('Welcome messages are now **enabled**.')
        .setColor(0x57F287);
      return message.reply({ embeds: [embed] });
    }

    // ── disable ───────────────────────────────────────────────────────────────
    if (sub === 'disable') {
      await updateGreetingConfig(guildId, 'welcome', { enabled: false });
      const embed = new EmbedBuilder()
        .setTitle(`${gEmoji('success', '✅')}Welcome Disabled`)
        .setDescription('Welcome messages are now **disabled**.')
        .setColor(0xED4245);
      return message.reply({ embeds: [embed] });
    }

    // ── mode ──────────────────────────────────────────────────────────────────
    if (sub === 'mode') {
      const mode = (args[1] || '').toLowerCase();
      if (!['standalone', 'embed', 'text'].includes(mode)) {
        const embed = new EmbedBuilder()
          .setTitle(`${gEmoji('error', '❌')}Invalid Mode`)
          .setDescription(`Valid modes: \`standalone\` (Canvas card attachment), \`embed\` (Custom Discord Embed), \`text\` (Text only).`)
          .setColor(0xED4245);
        return message.reply({ embeds: [embed] });
      }

      await updateGreetingConfig(guildId, 'welcome', { mode });
      const embed = new EmbedBuilder()
        .setTitle(`${gEmoji('success', '✅')}Welcome Mode Set`)
        .setDescription(`Welcome delivery format set to **${mode}**.`)
        .setColor(0x57F287);
      return message.reply({ embeds: [embed] });
    }

    // ── channel ───────────────────────────────────────────────────────────────
    if (sub === 'channel') {
      const channel = message.mentions.channels.first() || message.guild.channels.cache.get(args[1]);
      if (!channel || !channel.isTextBased()) {
        const embed = new EmbedBuilder()
          .setTitle(`${gEmoji('error', '❌')}Invalid Channel`)
          .setDescription('Please mention a valid text channel. Example: `' + prefix + 'welcome channel #welcome`')
          .setColor(0xED4245);
        return message.reply({ embeds: [embed] });
      }

      const cfg = await getGreetingConfig(guildId);
      const permCheck = checkChannelPermissions(channel, message.guild, cfg?.welcome?.mode || 'standalone', cfg?.welcome?.useCard !== false);

      if (!permCheck.ok) {
        const embed = new EmbedBuilder()
          .setTitle(`${gEmoji('error', '⚠️')}Missing Permissions in ${channel}`)
          .setDescription(
            `Ira Music is missing required permissions in ${channel}:\n` +
            `• **Missing:** \`${permCheck.missing.join('`, `')}\`\n\n` +
            `Please grant these permissions in channel settings before selecting this channel.`
          )
          .setColor(0xED4245);
        return message.reply({ embeds: [embed] });
      }

      await updateGreetingConfig(guildId, 'welcome', { channelId: channel.id });
      const embed = new EmbedBuilder()
        .setTitle(`${gEmoji('success', '✅')}Welcome Channel Set`)
        .setDescription(`Welcome messages will be sent to ${channel}. All required permissions verified!`)
        .setColor(0x57F287);
      return message.reply({ embeds: [embed] });
    }

    // ── message ───────────────────────────────────────────────────────────────
    if (sub === 'message') {
      const text = args.slice(1).join(' ').trim();
      if (!text || text.length < 1 || text.length > 1000) {
        const embed = new EmbedBuilder()
          .setTitle(`${gEmoji('error', '❌')}Invalid Message`)
          .setDescription('Please provide a message (1–1000 characters).\nExample: `' + prefix + 'welcome message Welcome {user} to {server}! 🎉`')
          .setColor(0xED4245);
        return message.reply({ embeds: [embed] });
      }
      await updateGreetingConfig(guildId, 'welcome', { message: text });
      const embed = new EmbedBuilder()
        .setTitle(`${gEmoji('success', '✅')}Welcome Message Set`)
        .addFields({ name: 'New Message', value: `\`\`\`${text}\`\`\`` })
        .setColor(0x57F287);
      return message.reply({ embeds: [embed] });
    }

    // ── embedtitle ────────────────────────────────────────────────────────────
    if (sub === 'embedtitle') {
      const text = args.slice(1).join(' ').trim();
      if (!text) {
        const embed = new EmbedBuilder().setTitle(`${gEmoji('error', '❌')}Invalid Title`).setDescription('Provide embed title text.').setColor(0xED4245);
        return message.reply({ embeds: [embed] });
      }
      await updateGreetingConfig(guildId, 'welcome', { 'embedConfig.title': text });
      const embed = new EmbedBuilder().setTitle(`${gEmoji('success', '✅')}Embed Title Set`).setDescription(`Title: \`${text}\``).setColor(0x57F287);
      return message.reply({ embeds: [embed] });
    }

    // ── embeddesc ─────────────────────────────────────────────────────────────
    if (sub === 'embeddesc') {
      const text = args.slice(1).join(' ').trim();
      if (!text) {
        const embed = new EmbedBuilder().setTitle(`${gEmoji('error', '❌')}Invalid Description`).setDescription('Provide embed description text.').setColor(0xED4245);
        return message.reply({ embeds: [embed] });
      }
      await updateGreetingConfig(guildId, 'welcome', { 'embedConfig.description': text });
      const embed = new EmbedBuilder().setTitle(`${gEmoji('success', '✅')}Embed Description Set`).setDescription(`Description: \`\`\`${text}\`\`\``).setColor(0x57F287);
      return message.reply({ embeds: [embed] });
    }

    // ── embedcolor ────────────────────────────────────────────────────────────
    if (sub === 'embedcolor') {
      const hex = (args[1] || '').trim();
      if (!/^#[0-9A-F]{6}$/i.test(hex)) {
        const embed = new EmbedBuilder().setTitle(`${gEmoji('error', '❌')}Invalid HEX Color`).setDescription('Specify a valid HEX color code. Example: `#8B5CF6`').setColor(0xED4245);
        return message.reply({ embeds: [embed] });
      }
      await updateGreetingConfig(guildId, 'welcome', { 'embedConfig.color': hex });
      const embed = new EmbedBuilder().setTitle(`${gEmoji('success', '✅')}Embed Color Set`).setDescription(`Color: \`${hex}\``).setColor(0x57F287);
      return message.reply({ embeds: [embed] });
    }

    // ── card ──────────────────────────────────────────────────────────────────
    if (sub === 'card') {
      const toggle = (args[1] || '').toLowerCase();
      if (toggle !== 'on' && toggle !== 'off') {
        const embed = new EmbedBuilder().setTitle(`${gEmoji('error', '❌')}Invalid Option`).setDescription('Use `on` or `off`').setColor(0xED4245);
        return message.reply({ embeds: [embed] });
      }
      await updateGreetingConfig(guildId, 'welcome', { useCard: toggle === 'on' });
      const embed = new EmbedBuilder()
        .setTitle(`${gEmoji('success', '✅')}Welcome Card ${toggle === 'on' ? 'Enabled' : 'Disabled'}`)
        .setDescription(`Welcome card images are now **${toggle === 'on' ? 'on' : 'off'}**.`)
        .setColor(0x57F287);
      return message.reply({ embeds: [embed] });
    }

    // ── preview ───────────────────────────────────────────────────────────────
    if (sub === 'preview') {
      const loadingMsg = await message.reply({ content: '🎨 Generating welcome preview...' });
      try {
        const cfg = await getGreetingConfig(guildId);
        const imgBuffer = await renderCard({
          type: 'welcome',
          displayName: message.author.displayName || message.author.username,
          username: message.author.username,
          avatarUrl: message.author.displayAvatarURL({ extension: 'png', size: 256, forceStatic: true }),
          guildName: message.guild.name,
          memberCount: message.guild.memberCount,
          memberNumber: message.guild.memberCount,
          cardConfig: cfg?.welcome?.card || {},
        });
        if (!imgBuffer) {
          await loadingMsg.edit({ content: '⚠️ Canvas renderer is not available.' });
          return;
        }
        await loadingMsg.edit({ content: '**Welcome Preview:**', files: [{ attachment: imgBuffer, name: 'welcome-preview.png' }] });
      } catch (err) {
        await loadingMsg.edit({ content: `❌ Preview failed: ${err.message}` });
      }
      return;
    }

    // ── reset ─────────────────────────────────────────────────────────────────
    if (sub === 'reset') {
      await resetGreetingConfig(guildId, 'welcome');
      const embed = new EmbedBuilder()
        .setTitle(`${gEmoji('success', '✅')}Welcome Reset`)
        .setDescription('Welcome configuration has been reset to defaults.')
        .setColor(0x57F287);
      return message.reply({ embeds: [embed] });
    }

    // ── Unknown subcommand ────────────────────────────────────────────────────
    const embed = new EmbedBuilder()
      .setTitle(`${gEmoji('error', '❌')}Unknown Subcommand`)
      .setDescription(`Use \`${prefix}welcome\` to see all available options.`)
      .setColor(0xED4245);
    return message.reply({ embeds: [embed] });
  },
};
