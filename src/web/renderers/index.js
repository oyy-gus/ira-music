'use strict';

const renderLayout = require('./layoutRenderer');
const renderHome = require('./homeRenderer');
const renderFeatures = require('./featuresRenderer');
const renderCommands = require('./commandsRenderer');
const renderLeaderboard = require('./leaderboardRenderer');
const renderNowPlaying = require('./nowplayingRenderer');
const renderStatus = require('./statusRenderer');
const renderBotStats = require('./botstatsRenderer');
const renderTerms = require('./termsRenderer');
const renderPrivacy = require('./privacyRenderer');
const renderServers = require('./serversRenderer');
const renderServerSettings = require('./serverSettingsRenderer');
const { pageMembers, pageMemberDetail } = require('./membersRenderer');

module.exports = {
  renderLayout,
  pageHome: renderHome,
  pageFeatures: renderFeatures,
  pageCommands: renderCommands,
  pageLeaderboard: renderLeaderboard,
  pageNowPlaying: renderNowPlaying,
  pageStatus: renderStatus,
  pageBotStats: renderBotStats,
  pageTerms: renderTerms,
  pagePrivacy: renderPrivacy,
  pageServers: renderServers,
  pageServerSettings: renderServerSettings,
  pageMembers,
  pageMemberDetail,
};
