'use strict';

const { sendLeave } = require('../../services/greetingService');

module.exports = {
  name: 'guildMemberRemove',
  once: false,
  async execute(member, client) {
    sendLeave(member, client).catch(() => {});
  },
};
