class CustomError extends Error {
  /**
   * @param {string} code - Machine-readable error code
   * @param {string} userMessage - User-friendly message safe for Discord output
   * @param {string} [technicalDetails] - Technical error log details
   * @param {Object} [metadata={}] - Contextual metadata (guildId, userId, nodeId, etc.)
   */
  constructor(code, userMessage, technicalDetails = '', metadata = {}) {
    super(technicalDetails || userMessage);
    this.name = 'CustomError';
    this.code = code;
    this.userMessage = userMessage;
    this.technicalDetails = technicalDetails;
    this.metadata = metadata;
    Error.captureStackTrace(this, this.constructor);
  }
}

module.exports = CustomError;
