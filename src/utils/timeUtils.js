/**
 * Utility functions for formatting music duration, timestamps, and time intervals
 */

/**
 * Format duration in milliseconds (or seconds) to a standard digital timestamp string (HH:MM:SS or MM:SS)
 * @param {number} ms - Duration in milliseconds (or seconds if isSeconds=true)
 * @param {object} [options]
 * @param {boolean} [options.isSeconds=false] - Set to true if input is in seconds
 * @param {boolean} [options.isStream=false] - Set to true if track is a live stream
 * @returns {string} - Formatted timestamp string e.g. "03:45", "01:15:30", "Live Stream"
 */
function formatDuration(ms, options = {}) {
  const { isSeconds = false, isStream = false } = options;

  if (isStream) return 'Live Stream';
  if (!ms || isNaN(ms) || ms <= 0) return '00:00';

  const totalSeconds = Math.floor(isSeconds ? ms : ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const pad = (num) => num.toString().padStart(2, '0');

  if (hours > 0) {
    return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
  }
  return `${pad(minutes)}:${pad(seconds)}`;
}

/**
 * Format total duration in milliseconds/seconds to human readable text string (e.g. "2h 15m", "45m 30s", "12s")
 * @param {number} ms - Duration in milliseconds (or seconds if isSeconds=true)
 * @param {object} [options]
 * @param {boolean} [options.isSeconds=false]
 * @returns {string} - Human readable string e.g. "2h 15m", "45m"
 */
function formatDurationText(ms, options = {}) {
  const { isSeconds = false } = options;

  if (!ms || isNaN(ms) || ms <= 0) return '0m';

  const totalSeconds = Math.floor(isSeconds ? ms : ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
  }
  if (minutes > 0) {
    return seconds > 0 && minutes < 10 ? `${minutes}m ${seconds}s` : `${minutes}m`;
  }
  return `${seconds}s`;
}

/**
 * Create a sleek, modern progress bar for Discord embeds
 * @param {number} current - Current position in ms or seconds
 * @param {number} total - Total duration in ms or seconds
 * @param {object} [options]
 * @param {number} [options.size=12] - Length of the progress bar
 * @param {string} [options.filledChar='━'] - Character for filled progress bar
 * @param {string} [options.headChar='⚪'] - Head slider indicator character
 * @param {string} [options.unfilledChar='─'] - Character for unfilled progress bar
 * @returns {string} - Formatted progress bar string e.g. "━━━━━━⚪────────"
 */
function createProgressBar(current, total, options = {}) {
  const {
    size = 12,
    filledChar = '━',
    headChar = '⚪',
    unfilledChar = '─',
  } = options;

  if (!total || total <= 0) {
    return `${headChar}${unfilledChar.repeat(Math.max(1, size - 1))}`;
  }

  const progress = Math.min(Math.max(current / total, 0), 1);
  const index = Math.round(progress * size);

  const filled = filledChar.repeat(Math.max(0, index - 1));
  const unfilled = unfilledChar.repeat(Math.max(0, size - index));

  return `${filled}${headChar}${unfilled}`;
}

module.exports = {
  formatDuration,
  formatDurationText,
  createProgressBar,
};
