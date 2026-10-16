'use strict';

const { sendWelcome } = require('../../services/greetingService');

module.exports = {
  name: 'guildMemberAdd',
  once: false,
  async execute(member, client) {
    // Fire-and-forget; errors are isolated inside sendWelcome
    sendWelcome(member, client).catch(() => {});
  },
};
