'use strict';

const fs = require('fs');
const path = require('path');
const renderLayout = require('./layoutRenderer');
const config = require('../../config');

const htmlPath = path.join(__dirname, '../html/commands.html');
const tpl = fs.readFileSync(htmlPath, 'utf8');

const renderCommands = (client, user) => {
  const prefix = config.discord?.defaultPrefix || '*';
  const body = tpl.replace(/\{\{PREFIX\}\}/g, prefix);
  return renderLayout(client, user, 'commands', 'Commands', body);
};

module.exports = renderCommands;
