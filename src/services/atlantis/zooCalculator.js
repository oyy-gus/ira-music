'use strict';

const smallNumbersToBig = {
  '⁰': 0,
  '¹': 1,
  '²': 2,
  '³': 3,
  '⁴': 4,
  '⁵': 5,
  '⁶': 6,
  '⁷': 7,
  '⁸': 8,
  '⁹': 9,
};

const rankData = {
  common: { cowoncy: 1, essence: 1, points: 1 },
  uncommon: { cowoncy: 3, essence: 5, points: 5 },
  rare: { cowoncy: 10, essence: 20, points: 20 },
  epic: { cowoncy: 250, essence: 250, points: 250 },
  mythic: { cowoncy: 5000, essence: 3000, points: 3000 },
  patreon: { cowoncy: 1000, essence: 500, points: 500 },
  cpatreon: { cowoncy: 50000, essence: 25000, points: 25000 },
  legendary: { cowoncy: 15000, essence: 10000, points: 10000 },
  gem: { cowoncy: 30000, essence: 20000, points: 20000 },
  botrank: { cowoncy: 50000, essence: 10000, points: 30000 },
  fabled: { cowoncy: 250000, essence: 100000, points: 100000 },
  special: { cowoncy: 6000, essence: 5000, points: 500 },
  hidden: { cowoncy: 1000000, essence: 500000, points: 500000 },
};

const allRanks = [
  'common',
  'uncommon',
  'rare',
  'epic',
  'mythic',
  'patreon',
  'cpatreon',
  'legendary',
  'gem',
  'botrank',
  'fabled',
  'special',
  'hidden',
];

const findSmallNumbers = /([⁰¹²³⁴⁵⁶⁷⁸⁹]){1,9}/g;
const numberFormatter = new Intl.NumberFormat('en-US');

/**
 * Calculates Zoo Cowoncy and Essence from raw message contents.
 * @param {string} text - Concatenated zoo message content
 * @returns {{ totals: Object, totalCowoncy: number, totalEssence: number, formatted: string }}
 */
function calculateZooStats(text) {
  if (!text) {
    return { totals: {}, totalCowoncy: 0, totalEssence: 0, formatted: '' };
  }

  const lines = text.split('\n');
  const totals = {};
  let lastRank = '';

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    for (let r = 0; r < allRanks.length; r++) {
      const rank = allRanks[r];
      const rankRegex = new RegExp(`:${rank}:`, 'gi');

      if (rankRegex.test(line)) {
        lastRank = rank;
        const matches = line.match(findSmallNumbers);
        let rankCount = 0;

        if (matches) {
          for (const match of matches) {
            let numStr = '';
            for (let c = 0; c < match.length; c++) {
              numStr += smallNumbersToBig[match[c]] !== undefined ? smallNumbersToBig[match[c]] : '';
            }
            if (numStr) rankCount += parseInt(numStr, 10);
          }
        }

        const cowoncy = rankCount * rankData[rank].cowoncy;
        const essence = rankCount * rankData[rank].essence;

        totals[rank] = {
          count: (totals[rank]?.count || 0) + rankCount,
          cowoncy: (totals[rank]?.cowoncy || 0) + cowoncy,
          essence: (totals[rank]?.essence || 0) + essence,
        };
      }
    }

    // Special cases for blank emojis
    if (/:blank:/gi.test(line) && lastRank) {
      const matches = line.match(findSmallNumbers);
      let animalCount = 0;

      if (matches) {
        for (const match of matches) {
          let numStr = '';
          for (let c = 0; c < match.length; c++) {
            numStr += smallNumbersToBig[match[c]] !== undefined ? smallNumbersToBig[match[c]] : '';
          }
          if (numStr) animalCount += parseInt(numStr, 10);
        }
      }

      if (totals[lastRank]) {
        const extraCowoncy = animalCount * (rankData[lastRank]?.cowoncy || 0);
        const extraEssence = animalCount * (rankData[lastRank]?.essence || 0);
        totals[lastRank].count += animalCount;
        totals[lastRank].cowoncy += extraCowoncy;
        totals[lastRank].essence += extraEssence;
      }
    }
  }

  let totalCowoncy = 0;
  let totalEssence = 0;
  const breakdown = [];

  for (const rank of Object.keys(totals)) {
    totalCowoncy += totals[rank].cowoncy;
    totalEssence += totals[rank].essence;
    breakdown.push(
      `\`${rank}\`: **${numberFormatter.format(totals[rank].cowoncy)}** cowoncy | **${numberFormatter.format(
        totals[rank].essence
      )}** essence (${numberFormatter.format(totals[rank].count)} animals)`
    );
  }

  return {
    totals,
    totalCowoncy,
    totalEssence,
    formatted: breakdown.join('\n'),
    formattedCowoncy: numberFormatter.format(totalCowoncy),
    formattedEssence: numberFormatter.format(totalEssence),
  };
}

module.exports = {
  smallNumbersToBig,
  rankData,
  allRanks,
  calculateZooStats,
  numberFormatter,
};
