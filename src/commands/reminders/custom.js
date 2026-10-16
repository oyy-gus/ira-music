'use strict';

const { EmbedBuilder } = require('discord.js');
const atlantisService = require('../../services/atlantis/atlantisService');
const AtlantisUser = require('../../database/models/AtlantisUser');

const parseTimeString = (timeStr) => {
  if (!timeStr) return 0;
  const upper = timeStr.toUpperCase();
  let totalMs = 0;
  const matches = upper.match(/(\d+)([MS])/g);
  if (!matches) return 0;

  for (const part of matches) {
    const unit = part.slice(-1);
    const val = parseInt(part.slice(0, -1), 10);
    if (isNaN(val)) continue;
    if (unit === 'S') totalMs += val * 1000;
    if (unit === 'M') totalMs += val * 60000;
  }

  return totalMs;
};

module.exports = {
  name: 'custom',
  description: 'Manage custom keyword timers (set, delete, or view)',
  aliases: ['customs', 'timer', 'timers'],
  category: 'reminders',
  cooldown: 3,
  async execute({ message, args, rawArgsString, prefix = '*' }) {
    const userDoc = await atlantisService.getOrCreateUser(message.author.id);
    const customs = userDoc.customs || [];

    // Helper error embed
    const sendError = (desc) => {
      const errEmbed = new EmbedBuilder()
        .setTitle('❌ Custom Timer Error')
        .setDescription(desc)
        .setColor(0xED4245)
        .setTimestamp();
      return message.reply({ embeds: [errEmbed] });
    };

    // 1. View Custom Timers
    if (!args || args.length === 0) {
      const embed = new EmbedBuilder()
        .setTitle('⏱️ Your Custom Timers')
        .setDescription(
          `Custom timers alert you when a keyword or phrase cooldown elapses.\n\n` +
          `**Syntax:**\n` +
          `• Set timer: \`${prefix}custom set <b|a|e> <time> <phrase>\`\n` +
          `  - \`b\`: Message begins with phrase\n` +
          `  - \`a\`: Message contains phrase\n` +
          `  - \`e\`: Message ends with phrase\n` +
          `  - *Example:* \`${prefix}custom set b 1M30S owo pray\`\n` +
          `• Delete timer: \`${prefix}custom delete <slot 1-3>\``
        )
        .setColor(0x8B5CF6)
        .setTimestamp();

      let hasAny = false;
      for (let i = 0; i < 3; i++) {
        const slot = customs[i] || { id: i + 1, unlocked: true, triggerText: '', time: 0 };
        const slotNum = i + 1;

        if (slot.triggerText && slot.time > 0) {
          hasAny = true;
          const trigType = slot.trigger === 'b' ? 'Begins With' : slot.trigger === 'a' ? 'Contains' : 'Ends With';
          embed.addFields({
            name: `Slot ${slotNum}: \`${slot.triggerText}\``,
            value: `• **Trigger Check:** \`${trigType} (${slot.trigger})\`\n• **Duration:** \`${slot.displayTime || slot.time / 1000 + 's'}\``,
            inline: false,
          });
        } else {
          embed.addFields({
            name: `Slot ${slotNum}: \`Empty\``,
            value: `Ready for a new timer.`,
            inline: false,
          });
        }
      }

      return message.reply({ embeds: [embed] });
    }

    const subCommand = (args[0] || '').toLowerCase();

    // 2. Set Custom Timer
    if (subCommand === 'set') {
      const triggerType = (args[1] || '').toLowerCase(); // b | a | e
      const timeStr = (args[2] || '').toUpperCase(); // 1M30S

      if (!triggerType || !timeStr || args.length < 4) {
        return sendError(
          `Missing parameters!\n**Usage:** \`${prefix}custom set <b|a|e> <time e.g. 1M30S> <phrase>\``
        );
      }

      if (!['b', 'a', 'e'].includes(triggerType)) {
        return sendError('Trigger check must be `b` (begins with), `a` (contains), or `e` (ends with).');
      }

      const durationMs = parseTimeString(timeStr);
      if (durationMs < 5000 || durationMs > 24 * 60 * 60 * 1000) {
        return sendError('Timer duration must be between `5S` (5 seconds) and `24H` (e.g. `30S`, `1M30S`, `5M`).');
      }

      // Extract trigger text from rawArgsString: slice after timeStr
      const timeIdx = rawArgsString.indexOf(args[2]);
      const triggerPhrase = timeIdx !== -1 ? rawArgsString.substring(timeIdx + args[2].length).trim() : args.slice(3).join(' ');

      if (!triggerPhrase || triggerPhrase.length < 1) {
        return sendError('Please specify the trigger word or phrase.');
      }

      // Find first available slot (1-3)
      let targetSlotIndex = -1;
      for (let i = 0; i < 3; i++) {
        if (!customs[i] || !customs[i].triggerText || customs[i].time === 0) {
          targetSlotIndex = i;
          break;
        }
      }

      if (targetSlotIndex === -1) {
        return sendError('All 3 custom timer slots are full. Use `*custom delete <1-3>` to free up a slot.');
      }

      const updatedCustoms = [...customs];
      while (updatedCustoms.length < 3) {
        updatedCustoms.push({ id: updatedCustoms.length + 1, unlocked: true, trigger: '', triggerText: '', time: 0, displayTime: '' });
      }

      updatedCustoms[targetSlotIndex] = {
        id: targetSlotIndex + 1,
        unlocked: true,
        trigger: triggerType,
        triggerText: triggerPhrase,
        time: durationMs,
        displayTime: timeStr,
      };

      await AtlantisUser.updateOne(
        { userId: message.author.id },
        { $set: { customs: updatedCustoms } }
      );

      const successEmbed = new EmbedBuilder()
        .setTitle('✅ Custom Timer Created')
        .setDescription(
          `Timer set in **Slot ${targetSlotIndex + 1}**!\n\n` +
          `• **Phrase:** \`${triggerPhrase}\`\n` +
          `• **Check:** \`${triggerType === 'b' ? 'Begins with' : triggerType === 'a' ? 'Contains' : 'Ends with'}\`\n` +
          `• **Duration:** \`${timeStr}\``
        )
        .setColor(0x57F287)
        .setTimestamp();

      return message.reply({ embeds: [successEmbed] });
    }

    // 3. Delete Custom Timer
    if (subCommand === 'delete' || subCommand === 'del' || subCommand === 'remove') {
      const slotNum = parseInt(args[1], 10);
      if (isNaN(slotNum) || slotNum < 1 || slotNum > 3) {
        return sendError('Please provide a valid slot number between 1 and 3 (e.g. `*custom delete 1`).');
      }

      const targetSlotIndex = slotNum - 1;
      const updatedCustoms = [...customs];
      while (updatedCustoms.length < 3) {
        updatedCustoms.push({ id: updatedCustoms.length + 1, unlocked: true, trigger: '', triggerText: '', time: 0, displayTime: '' });
      }

      updatedCustoms[targetSlotIndex] = {
        id: slotNum,
        unlocked: true,
        trigger: '',
        triggerText: '',
        time: 0,
        displayTime: '',
      };

      await AtlantisUser.updateOne(
        { userId: message.author.id },
        { $set: { customs: updatedCustoms } }
      );

      const delEmbed = new EmbedBuilder()
        .setTitle('🗑️ Custom Timer Deleted')
        .setDescription(`Custom timer in **Slot ${slotNum}** has been cleared.`)
        .setColor(0x57F287)
        .setTimestamp();

      return message.reply({ embeds: [delEmbed] });
    }

    return sendError(`Unknown subcommand. Use \`${prefix}custom\` to view your timers or \`${prefix}custom set\` to create one.`);
  },
};
