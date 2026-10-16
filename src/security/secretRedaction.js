/**
 * Centralized Secret and Sensitive Data Redaction
 */

const SENSITIVE_PATTERNS = [
  /([a-zA-Z0-9_-]{24}\.[a-zA-Z0-9_-]{6}\.[a-zA-Z0-9_-]{27,38})/g, // Discord Bot Token
  /(Bearer\s+)[a-zA-Z0-9_\-\.]{15,}/gi,                             // Bearer Tokens
  /(mongodb(?:\+srv)?:\/\/[^:]+:)([^@]+)(@)/gi,                      // MongoDB Password
  /((?:api[_-]?key|secret|password|auth|authorization|token)\s*[:=]\s*["']?)([^"'\s,;]+)(["']?)/gi,
];

class SecretRedaction {
  /**
   * Redact sensitive tokens, passwords, and authorization keys from strings
   * @param {string} text
   * @returns {string}
   */
  static redactString(text) {
    if (typeof text !== 'string') return text;

    let sanitized = text;

    // Discord Token
    sanitized = sanitized.replace(/[a-zA-Z0-9_\-]{24,28}\.[a-zA-Z0-9_\-]{6}\.[a-zA-Z0-9_\-]{27,38}/g, '********');

    // Bearer Token
    sanitized = sanitized.replace(/(Bearer\s+)[a-zA-Z0-9_\-\.]{15,}/gi, '$1********');

    // MongoDB URI Password
    sanitized = sanitized.replace(/(mongodb(?:\+srv)?:\/\/[^:]+:)([^@]+)(@)/gi, '$1********$3');

    // Key-value pairs
    sanitized = sanitized.replace(/((?:api[_-]?key|secret|password|auth|authorization|token)\s*[:=]\s*["']?)([^"'\s,;]+)(["']?)/gi, '$1********$3');

    return sanitized;
  }

  /**
   * Deeply sanitize an object or array to prevent secrets from being logged or stored
   * @param {*} data
   * @param {number} depth
   * @returns {*}
   */
  static sanitize(data, depth = 0) {
    if (depth > 8) return '[Max Depth]';
    if (!data) return data;

    if (typeof data === 'string') {
      return this.redactString(data);
    }

    if (Array.isArray(data)) {
      return data.map((item) => this.sanitize(item, depth + 1));
    }

    if (typeof data === 'object' && !(data instanceof Date) && !(data instanceof RegExp)) {
      const cleanObj = {};
      const sensitiveKeys = ['token', 'password', 'secret', 'authorization', 'auth', 'apikey', 'api_key'];

      for (const [key, val] of Object.entries(data)) {
        if (sensitiveKeys.some((k) => key.toLowerCase().includes(k))) {
          cleanObj[key] = '********';
        } else {
          cleanObj[key] = this.sanitize(val, depth + 1);
        }
      }
      return cleanObj;
    }

    return data;
  }
}

module.exports = SecretRedaction;
