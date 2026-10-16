const fs = require('fs');
const path = require('path');
const logger = require('../logger/logger');

const loadEvents = (client) => {
  const eventsDir = path.join(__dirname, '../events');

  if (!fs.existsSync(eventsDir)) {
    logger.warn(`Events directory not found at ${eventsDir}`);
    return;
  }

  const eventCategories = fs.readdirSync(eventsDir);
  let totalEvents = 0;

  for (const category of eventCategories) {
    const categoryPath = path.join(eventsDir, category);
    if (!fs.statSync(categoryPath).isDirectory()) continue;

    const eventFiles = fs.readdirSync(categoryPath).filter(file => file.endsWith('.js'));

    for (const file of eventFiles) {
      const filePath = path.join(categoryPath, file);
      try {
        delete require.cache[require.resolve(filePath)];
        const event = require(filePath);

        if (!event.name || typeof event.execute !== 'function') {
          logger.warn(`Event at ${filePath} missing 'name' or 'execute' function.`);
          continue;
        }

        if (event.once) {
          client.once(event.name, (...args) => event.execute(...args, client));
        } else {
          client.on(event.name, (...args) => event.execute(...args, client));
        }

        totalEvents++;
        logger.debug(`Registered event: ${event.name} [Category: ${category}]`);
      } catch (error) {
        logger.error(`Failed to register event at ${filePath}`, { error: error.message });
      }
    }
  }

  logger.info(`Successfully loaded ${totalEvents} client events.`);
};

module.exports = {
  loadEvents,
};
