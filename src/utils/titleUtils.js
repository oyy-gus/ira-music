/**
 * Utility functions for cleaning and formatting song titles across the bot
 */

/**
 * Clean track title by removing markdown syntax characters and unwanted special symbols
 * @param {string} title - Raw track title
 * @returns {string} - Cleaned title string
 */
function cleanTrackTitle(title) {
  if (!title || typeof title !== 'string') return 'Unknown Track';

  return title
    // Remove markdown formatting characters that break Discord embed links or text formatting
    .replace(/[`*~_|\[\]\\]/g, '')
    // Replace non-standard whitespace or control characters with standard space
    .replace(/[\r\n\t]/g, ' ')
    // Normalize multiple spaces into a single space
    .replace(/\s+/g, ' ')
    .trim() || 'Unknown Track';
}

/**
 * Clean and truncate a track title with '...' if it exceeds maxLength
 * @param {string} title - Raw track title
 * @param {number} maxLength - Maximum character length allowed (default: 45)
 * @returns {string} - Cleaned and formatted title ending with '...' if truncated
 */
function formatTrackTitle(title, maxLength = 45) {
  const cleaned = cleanTrackTitle(title);
  if (cleaned.length <= maxLength) {
    return cleaned;
  }
  const cutLen = Math.max(1, maxLength - 3);
  return `${cleaned.slice(0, cutLen).trim()}...`;
}

module.exports = {
  cleanTrackTitle,
  formatTrackTitle,
};
