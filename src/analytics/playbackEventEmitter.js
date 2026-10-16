const EventEmitter = require('events');
const crypto = require('crypto');
const AnalyticsEvent = require('../database/models/AnalyticsEvent');
const logger = require('../logger/logger');

class PlaybackEventEmitter extends EventEmitter {
  constructor() {
    super();
    // Increase max listeners for analytics subscribers
    this.setMaxListeners(50);
  }

  /**
   * Dispatch an analytics event asynchronously without blocking caller
   * @param {Object} eventData
   */
  emitEvent(eventType, eventData = {}) {
    const eventId = `evt-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
    const payload = {
      eventId,
      eventType,
      timestamp: new Date(),
      ...eventData,
    };

    // Emit in-memory event to active subscribers
    this.emit(eventType, payload);
    this.emit('*', payload);

    // Persist to MongoDB asynchronously without awaiting
    setImmediate(async () => {
      try {
        const doc = new AnalyticsEvent({
          eventId,
          guildId: payload.guildId,
          userId: payload.userId,
          playerId: payload.playerId || payload.guildId,
          trackId: payload.trackId || payload.metadata?.identifier || 'unknown',
          eventType,
          timestamp: payload.timestamp,
          metadata: payload.metadata || {},
        });
        await doc.save();
      } catch (err) {
        logger.debug(`[Analytics] Background persist failed: ${err.message}`);
      }
    });

    return eventId;
  }
}

module.exports = new PlaybackEventEmitter();
