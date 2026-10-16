'use strict';

const fs = require('fs');
const path = require('path');
const renderLayout = require('./layoutRenderer');
const config = require('../../config');

const htmlPath = path.join(__dirname, '../html/terms.html');
const tpl = fs.readFileSync(htmlPath, 'utf8');

const renderTerms = (client, user) => {
  const botName = client?.user?.username || 'IRA Music';
  const lastUpdated = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  const supportUrl = config.discord?.supportServerUrl || '#';

  const body = tpl
    .replace(/\{\{BOT_NAME\}\}/g, botName)
    .replace(/\{\{LAST_UPDATED\}\}/g, lastUpdated)
    .replace(/\{\{SUPPORT_URL\}\}/g, supportUrl);

  return renderLayout(client, user, 'terms', 'Terms of Service', body);
};

module.exports = renderTerms;
