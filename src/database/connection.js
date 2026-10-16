const mongoose = require('mongoose');
const config = require('../config');
const logger = require('../logger/logger');

let isConnected = false;

const connectDB = async () => {
  if (isConnected) return;

  try {
    mongoose.set('strictQuery', true);

    const conn = await mongoose.connect(config.database.uri, {
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    });

    isConnected = true;
    logger.info(`MongoDB connected successfully to host: ${conn.connection.host}`);

    // Drop stale/obsolete indexes if they exist
    try {
      const usersCollection = conn.connection.db.collection('users');
      const indexes = await usersCollection.indexes();
      if (indexes.some(idx => idx.name === 'email_1')) {
        await usersCollection.dropIndex('email_1');
        logger.info('Dropped obsolete index email_1 from users collection');
      }
    } catch (idxErr) {
      // Ignore if index doesn't exist or already dropped
    }

    try {
      const membersCollection = conn.connection.db.collection('atlantismembers');
      const memberIndexes = await membersCollection.indexes();
      if (memberIndexes.some(idx => idx.name === 'userId_1' && idx.unique)) {
        await membersCollection.dropIndex('userId_1');
        logger.info('Dropped obsolete unique index userId_1 from atlantismembers collection');
      }
    } catch (idxErr) {
      // Ignore if index doesn't exist or already dropped
    }

    mongoose.connection.on('disconnected', () => {

      isConnected = false;
      logger.warn('MongoDB connection lost. Attempting reconnection...');
    });

    mongoose.connection.on('reconnected', () => {
      isConnected = true;
      logger.info('MongoDB connection restored.');
    });

    mongoose.connection.on('error', (err) => {
      logger.error('MongoDB database connection error:', { error: err.message });
    });

  } catch (error) {
    logger.error('Failed to establish MongoDB connection:', { error: error.message });
    // Soft handle connection failure so bot can start even if DB is temporarily unreachable
  }
};

const disconnectDB = async () => {
  if (!isConnected) return;
  await mongoose.disconnect();
  isConnected = false;
  logger.info('MongoDB disconnected cleanly.');
};

module.exports = {
  connectDB,
  disconnectDB,
  getConnectionStatus: () => isConnected,
};
