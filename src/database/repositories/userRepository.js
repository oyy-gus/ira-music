const User = require('../models/User');
const UserMusicProfile = require('../models/UserMusicProfile');
const MusicAchievement = require('../models/MusicAchievement');
const logger = require('../../logger/logger');
const { calculateProgression, evaluateXPGain } = require('../../services/xpService');
const { getUnlockedCosmeticsForLevel, DEFAULT_EQUIPPED_COSMETICS, getCosmeticById } = require('../../config/cosmetics');

const MILESTONE_BADGES = [
  { hours: 1,    badge: '🎧 First Hour' },
  { hours: 10,   badge: '🎵 Music Fan' },
  { hours: 50,   badge: '🔥 Dedicated' },
  { hours: 100,  badge: '💎 Devoted' },
  { hours: 250,  badge: '👑 Veteran' },
  { hours: 500,  badge: '🌌 Master' },
  { hours: 1000, badge: '⭐ Ira Legend' },
  { hours: 5000, badge: '🏆 Eternal Listener' },
];

/**
 * Returns only the badges the user has legitimately earned
 * based on their actual total listening time in seconds.
 * Strips any badge in the DB that was awarded prematurely.
 * @param {string[]} storedBadges - badges array from user document
 * @param {number} totalListeningSeconds - user's total listening time
 * @returns {string[]}
 */
const getSafeBadges = (storedBadges = [], totalListeningSeconds = 0) => {
  const totalHours = totalListeningSeconds / 3600;
  const earnedBadgeSet = new Set(
    MILESTONE_BADGES.filter((mb) => totalHours >= mb.hours).map((mb) => mb.badge)
  );
  // Only keep badges that are both in DB AND legitimately earned
  return (Array.isArray(storedBadges) ? storedBadges : []).filter((b) => earnedBadgeSet.has(b));
};

const getUser = async (discordId) => {
  try {
    let user = await User.findOne({ discordId }).lean();
    if (!user) {
      const defaultUnlocked = getUnlockedCosmeticsForLevel(1);
      user = await User.create({
        discordId,
        unlockedCosmetics: defaultUnlocked,
        equippedCosmetics: DEFAULT_EQUIPPED_COSMETICS,
      });
      user = user.toObject();
    }
    // Ensure default structures exist
    if (!user.equippedCosmetics) {
      user.equippedCosmetics = { ...DEFAULT_EQUIPPED_COSMETICS };
    }
    if (!user.unlockedCosmetics || user.unlockedCosmetics.length === 0) {
      user.unlockedCosmetics = getUnlockedCosmeticsForLevel(user.level || 1);
    }
    return user;
  } catch (error) {
    logger.error(`[UserRepo] Error getting user ${discordId}:`, { error: error.message });
    return {
      discordId,
      aboutMe: 'Music Enthusiast 🎧 | Enjoying live streams & beats',
      xp: 0,
      level: 1,
      badges: [],
      unlockedCosmetics: getUnlockedCosmeticsForLevel(1),
      equippedCosmetics: { ...DEFAULT_EQUIPPED_COSMETICS },
      statistics: { songsPlayed: 0, timeListenedSeconds: 0 },
      isPrivate: false,
    };
  }
};

const updateAboutMe = async (discordId, aboutMeText) => {
  try {
    const user = await User.findOneAndUpdate(
      { discordId },
      { $set: { aboutMe: aboutMeText } },
      { new: true, upsert: true }
    ).lean();
    return user;
  } catch (error) {
    logger.error(`[UserRepo] Error updating aboutMe for ${discordId}:`, { error: error.message });
    throw error;
  }
};

const recordTrackPlay = async (discordId, track, guild, companions = []) => {
  try {
    let user = await User.findOne({ discordId });
    if (!user) {
      user = await User.create({
        discordId,
        unlockedCosmetics: getUnlockedCosmeticsForLevel(1),
        equippedCosmetics: DEFAULT_EQUIPPED_COSMETICS,
      });
    }

    const durationSec = Math.floor((track.info?.duration || 0) / 1000);

    // 1. Update basic stats
    user.statistics.songsPlayed = (user.statistics.songsPlayed || 0) + 1;
    if (durationSec > 0) {
      user.statistics.timeListenedSeconds = (user.statistics.timeListenedSeconds || 0) + durationSec;
    }

    // Also update UserMusicProfile for analytics compatibility
    await UserMusicProfile.updateOne(
      { userId: discordId },
      {
        $inc: {
          'statistics.totalTracksPlayed': 1,
          'statistics.totalListeningTimeMs': durationSec * 1000,
        },
      },
      { upsert: true }
    ).catch(() => {});

    // 2. Update Top Tracks
    const trackTitle = track.info?.title || 'Unknown Track';
    const trackAuthor = track.info?.author || 'Unknown Artist';
    const trackUri = track.info?.uri || '';

    const trackIndex = user.topTracks.findIndex((t) => t.uri === trackUri || t.title === trackTitle);
    if (trackIndex > -1) {
      user.topTracks[trackIndex].playCount += 1;
    } else {
      user.topTracks.push({ title: trackTitle, author: trackAuthor, uri: trackUri, playCount: 1 });
    }
    user.topTracks.sort((a, b) => b.playCount - a.playCount);
    user.topTracks = user.topTracks.slice(0, 5);

    // 3. Update Top Guilds
    if (guild) {
      const guildIndex = user.topGuilds.findIndex((g) => g.guildId === guild.id);
      if (guildIndex > -1) {
        user.topGuilds[guildIndex].playCount += 1;
        user.topGuilds[guildIndex].guildName = guild.name;
      } else {
        user.topGuilds.push({ guildId: guild.id, guildName: guild.name, playCount: 1 });
      }
      user.topGuilds.sort((a, b) => b.playCount - a.playCount);
      user.topGuilds = user.topGuilds.slice(0, 5);
    }

    // 4. Update Top Companions (excluding bots and self)
    if (Array.isArray(companions)) {
      for (const member of companions) {
        if (!member.user.bot && member.user.id !== discordId) {
          const compName = member.nickname || member.displayName || member.user?.globalName || member.user?.username;
          const compIndex = user.topCompanions.findIndex((c) => c.userId === member.user.id);
          if (compIndex > -1) {
            user.topCompanions[compIndex].listenCount += 1;
            user.topCompanions[compIndex].username = compName;
          } else {
            user.topCompanions.push({
              userId: member.user.id,
              username: compName,
              listenCount: 1,
            });
          }
        }
      }
      user.topCompanions.sort((a, b) => b.listenCount - a.listenCount);
      user.topCompanions = user.topCompanions.slice(0, 5);
    }

    await user.save().catch((err) => {
      if (err.name !== 'VersionError') throw err;
    });
  } catch (error) {
    if (error.name !== 'VersionError') {
      logger.error(`[UserRepo] Error recording track play details for ${discordId}:`, { error: error.message });
    }
  }
};

/**
 * Add listening time in seconds, compute XP gain, evaluate level up, update badges & cosmetics
 */
const addListeningTimeAndXP = async (discordId, addedSeconds, guildId = null, guildName = '') => {
  if (!addedSeconds || addedSeconds <= 0) return null;
  try {
    let user = await User.findOne({ discordId });
    if (!user) {
      user = await User.create({
        discordId,
        unlockedCosmetics: getUnlockedCosmeticsForLevel(1),
        equippedCosmetics: DEFAULT_EQUIPPED_COSMETICS,
      });
    }

    // 1. Update total listening time
    user.statistics.timeListenedSeconds = (user.statistics.timeListenedSeconds || 0) + addedSeconds;

    // Also update UserMusicProfile
    await UserMusicProfile.updateOne(
      { userId: discordId },
      { $inc: { 'statistics.totalListeningTimeMs': addedSeconds * 1000 } },
      { upsert: true }
    ).catch(() => {});

    // 2. XP & Level evaluation
    const minutes = addedSeconds / 60;
    const xpGained = Math.max(1, Math.floor(minutes * 10));
    const currentTotalXP = user.xp || 0;
    const evalResult = evaluateXPGain(currentTotalXP, xpGained);

    user.xp = evalResult.newTotalXP;
    user.level = evalResult.newProgression.level;

    // 3. Milestone badges check
    const totalHours = Math.floor(user.statistics.timeListenedSeconds / 3600);
    const existingBadges = new Set(user.badges || []);
    for (const mb of MILESTONE_BADGES) {
      if (totalHours >= mb.hours && !existingBadges.has(mb.badge)) {
        user.badges.push(mb.badge);
      }
    }

    // 4. Cosmetics unlock check
    const unlockedForLvl = getUnlockedCosmeticsForLevel(user.level);
    const existingUnlocked = new Set(user.unlockedCosmetics || []);
    for (const item of unlockedForLvl) {
      existingUnlocked.add(item);
    }
    user.unlockedCosmetics = Array.from(existingUnlocked);

    // 5. Update per-guild listening time
    if (guildId) {
      const gIndex = user.guildListeningTime.findIndex((g) => g.guildId === guildId);
      if (gIndex > -1) {
        user.guildListeningTime[gIndex].listeningSeconds += addedSeconds;
        if (guildName) user.guildListeningTime[gIndex].guildName = guildName;
      } else {
        user.guildListeningTime.push({
          guildId,
          guildName: guildName || '',
          listeningSeconds: addedSeconds,
        });
      }
    }

    await user.save();
    return {
      user,
      xpGained,
      leveledUp: evalResult.leveledUp,
      newLevel: evalResult.newProgression.level,
    };
  } catch (error) {
    logger.error(`[UserRepo] Error adding listening time for ${discordId}:`, { error: error.message });
    return null;
  }
};

const equipCosmetic = async (discordId, cosmeticId) => {
  const item = getCosmeticById(cosmeticId);
  if (!item) throw new Error('Cosmetic item not found.');

  const user = await User.findOne({ discordId });
  if (!user) throw new Error('User profile not found.');

  const prog = calculateProgression(user.xp || 0);
  const userLevel = Math.max(user.level || 1, prog.level || 1);
  const unlockedList = getUnlockedCosmeticsForLevel(userLevel);
  const unlockedSet = new Set([...(user.unlockedCosmetics || []), ...unlockedList]);
  if (!unlockedSet.has(cosmeticId)) {
    throw new Error(`You have not unlocked '${item.name}' yet (Requires Level ${item.unlockLevel}).`);
  }

  if (!user.equippedCosmetics) {
    user.equippedCosmetics = { ...DEFAULT_EQUIPPED_COSMETICS };
  }

  user.equippedCosmetics[item.type] = cosmeticId;
  user.markModified('equippedCosmetics');
  await user.save();
  return user;
};

const getUserGlobalRank = async (discordId) => {
  try {
    const user = await User.findOne({ discordId }).lean();
    if (!user || !user.statistics?.timeListenedSeconds) return 'N/A';

    const countHigher = await User.countDocuments({
      'statistics.timeListenedSeconds': { $gt: user.statistics.timeListenedSeconds },
    });
    return countHigher + 1;
  } catch (err) {
    return 'N/A';
  }
};

const getUserGuildRank = async (discordId, guildId) => {
  try {
    const users = await User.find({ 'guildListeningTime.guildId': guildId }).lean();
    if (!users.length) return 'N/A';

    const userStats = users.map((u) => {
      const entry = u.guildListeningTime.find((g) => g.guildId === guildId);
      return {
        discordId: u.discordId,
        seconds: entry ? entry.listeningSeconds : 0,
      };
    });

    userStats.sort((a, b) => b.seconds - a.seconds);
    const index = userStats.findIndex((u) => u.discordId === discordId);
    return index > -1 ? index + 1 : 'N/A';
  } catch (err) {
    return 'N/A';
  }
};

const getGlobalTopUsers = async (limit = 10, excludeIds = []) => {
  const cleanExclude = (excludeIds || []).filter(Boolean).map(id => String(id));
  const query = {
    'statistics.timeListenedSeconds': { $gt: 0 },
    discordId: {
      $exists: true,
      $ne: null,
      $ne: 'null',
      $ne: 'undefined',
      $nin: cleanExclude
    }
  };
  return User.find(query)
    .sort({ 'statistics.timeListenedSeconds': -1 })
    .limit(limit)
    .lean();
};

const getServerTopUsers = async (guildId, limit = 10, excludeIds = []) => {
  const query = { 'guildListeningTime.guildId': guildId };
  if (excludeIds.length > 0) query.discordId = { $nin: excludeIds };
  const users = await User.find(query).lean();
  const processed = users.map((u) => {
    const entry = u.guildListeningTime.find((g) => g.guildId === guildId);
    return {
      ...u,
      guildListeningSeconds: entry ? entry.listeningSeconds : 0,
    };
  });

  processed.sort((a, b) => b.guildListeningSeconds - a.guildListeningSeconds);
  return processed.slice(0, limit);
};

const setProfilePrivacy = async (discordId, isPrivate) => {
  try {
    const user = await User.findOneAndUpdate(
      { discordId },
      { $set: { isPrivate: !!isPrivate } },
      { new: true, upsert: true }
    ).lean();
    return user;
  } catch (error) {
    logger.error(`[UserRepo] Error setting profile privacy for ${discordId}:`, { error: error.message });
    throw error;
  }
};

/**
 * Add XP to a specific user (admin command)
 */
const addXPToUser = async (discordId, amount) => {
  if (!amount || amount <= 0) throw new Error('XP amount must be a positive number.');
  let user = await User.findOne({ discordId });
  if (!user) {
    user = await User.create({
      discordId,
      unlockedCosmetics: getUnlockedCosmeticsForLevel(1),
      equippedCosmetics: DEFAULT_EQUIPPED_COSMETICS,
    });
  }

  const currentXP = user.xp || 0;
  const evalResult = evaluateXPGain(currentXP, amount);

  user.xp = evalResult.newTotalXP;
  user.level = evalResult.newProgression.level;

  // Unlock cosmetics for new level
  const unlockedForLvl = getUnlockedCosmeticsForLevel(user.level);
  const existingUnlocked = new Set(user.unlockedCosmetics || []);
  for (const item of unlockedForLvl) {
    existingUnlocked.add(item);
  }
  user.unlockedCosmetics = Array.from(existingUnlocked);

  await user.save();
  return {
    user,
    oldXP: currentXP,
    newXP: evalResult.newTotalXP,
    oldLevel: evalResult.oldLevel,
    newLevel: evalResult.newLevel,
    leveledUp: evalResult.leveledUp,
  };
};

/**
 * Remove/Reduce XP from a specific user (admin command)
 */
const removeXPFromUser = async (discordId, amount) => {
  if (!amount || amount <= 0) throw new Error('XP amount must be a positive number.');
  let user = await User.findOne({ discordId });
  if (!user) throw new Error('User profile not found in database.');

  const currentXP = user.xp || 0;
  const newTotalXP = Math.max(0, currentXP - amount);
  const prog = calculateProgression(newTotalXP);

  user.xp = newTotalXP;
  user.level = prog.level;

  // Re-evaluate unlocked cosmetics for lower level if level dropped
  const unlockedForLvl = getUnlockedCosmeticsForLevel(prog.level);
  user.unlockedCosmetics = unlockedForLvl;

  // Reset equipped cosmetics back to default if item is no longer unlocked
  const unlockedSet = new Set(unlockedForLvl);
  if (user.equippedCosmetics) {
    for (const [key, itemVal] of Object.entries(user.equippedCosmetics)) {
      if (itemVal && !unlockedSet.has(itemVal) && DEFAULT_EQUIPPED_COSMETICS[key]) {
        user.equippedCosmetics[key] = DEFAULT_EQUIPPED_COSMETICS[key];
      }
    }
  }

  await user.save();
  return {
    user,
    oldXP: currentXP,
    newXP: newTotalXP,
    newLevel: prog.level,
  };
};

/**
 * Reset XP for a specific user to 0 and level to 1 (admin command)
 * Also resets cosmetics, badges, statistics, and achievements back to initial defaults.
 */
const resetUserXP = async (discordId) => {
  const defaultUnlocked = getUnlockedCosmeticsForLevel(1);
  const user = await User.findOneAndUpdate(
    { discordId },
    {
      $set: {
        xp: 0,
        level: 1,
        badges: [],
        unlockedCosmetics: defaultUnlocked,
        equippedCosmetics: { ...DEFAULT_EQUIPPED_COSMETICS },
        statistics: { songsPlayed: 0, timeListenedSeconds: 0 },
        guildListeningTime: [],
        topTracks: [],
        topGuilds: [],
        topCompanions: [],
      },
    },
    { new: true, upsert: true }
  ).lean();

  // Reset MusicAchievement records for user
  await MusicAchievement.deleteMany({ userId: discordId }).catch(() => {});

  // Reset UserMusicProfile statistics for user
  await UserMusicProfile.updateOne(
    { userId: discordId },
    {
      $set: {
        'statistics.totalListeningTimeMs': 0,
        'statistics.totalTracksPlayed': 0,
        'statistics.totalUniqueArtists': 0,
        'statistics.mostActiveGuilds': [],
        'streak.currentStreak': 0,
        'streak.longestStreak': 0,
      },
    }
  ).catch(() => {});

  return user;
};

/**
 * Reset global XP for all users in database to 0 and level to 1 (admin command)
 * Also resets cosmetics, badges, statistics, and achievements for ALL users back to initial defaults.
 */
const resetGlobalXP = async () => {
  const defaultUnlocked = getUnlockedCosmeticsForLevel(1);
  const result = await User.updateMany(
    {},
    {
      $set: {
        xp: 0,
        level: 1,
        badges: [],
        unlockedCosmetics: defaultUnlocked,
        equippedCosmetics: { ...DEFAULT_EQUIPPED_COSMETICS },
        statistics: { songsPlayed: 0, timeListenedSeconds: 0 },
        guildListeningTime: [],
        topTracks: [],
        topGuilds: [],
        topCompanions: [],
      },
    }
  );

  // Clear all achievements
  await MusicAchievement.deleteMany({}).catch(() => {});

  // Reset UserMusicProfile stats
  await UserMusicProfile.updateMany(
    {},
    {
      $set: {
        'statistics.totalListeningTimeMs': 0,
        'statistics.totalTracksPlayed': 0,
        'statistics.totalUniqueArtists': 0,
        'statistics.mostActiveGuilds': [],
        'streak.currentStreak': 0,
        'streak.longestStreak': 0,
      },
    }
  ).catch(() => {});

  return result.modifiedCount || 0;
};

module.exports = {
  getUser,
  incrementStats: recordTrackPlay,
  updateAboutMe,
  recordTrackPlay,
  setProfilePrivacy,
  addListeningTimeAndXP,
  equipCosmetic,
  getUserGlobalRank,
  getUserGuildRank,
  getGlobalTopUsers,
  getServerTopUsers,
  addXPToUser,
  removeXPFromUser,
  resetUserXP,
  resetGlobalXP,
  getSafeBadges,
  MILESTONE_BADGES,
};
