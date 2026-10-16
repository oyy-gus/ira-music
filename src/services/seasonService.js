/**
 * Season System Service
 * Manages monthly seasons, seasonal leaderboards, and rewards.
 */

class SeasonService {
  static getCurrentSeason() {
    const now = new Date();
    const monthNames = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    const month = monthNames[now.getMonth()];
    const year = now.getFullYear();
    const seasonId = `${year}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    const startAt = new Date(year, now.getMonth(), 1);
    const endAt = new Date(year, now.getMonth() + 1, 0, 23, 59, 59);

    return {
      seasonId,
      name: `${month} ${year} Season`,
      startAt,
      endAt,
      status: 'ACTIVE',
    };
  }
}

module.exports = SeasonService;
