'use strict';

const atlantisService = require('../../services/atlantis/atlantisService');

module.exports = {
  name: 'messageCreate',
  once: false,
  async execute(message, client) {
    if (!message || !message.guild) return;

    // 1. Process Auto-Moderation (delbot, deluser, owochannel, delete prefix rules)
    const wasDeleted = await atlantisService.handleAutoModeration(message);
    if (wasDeleted) return;

    // 2. Process Game Reminders, Huntbot, Customs & Member Activity Tracking
    await atlantisService.processReminders(message);
  },
};
