/**
 * healthService.js — Re-exports from webServer.js.
 * The web dashboard & health endpoints are now served by src/web/webServer.js.
 * This file is kept for backward compatibility with src/index.js imports.
 */
const { startWebServer } = require('../web/webServer');

module.exports = {
  startHealthServer: startWebServer,
};
