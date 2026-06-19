// lib/parimutuel.js
// Core parimutuel math shared between live-odds display and settlement.

/**
 * Given the staked amounts per option for ONE question, compute the live
 * projected multiplier for each option, plus pool totals.
 *
 * @param {Array<{optionId, label, staked}>} options
 * @param {number} rolloverIn  extra money added to this question's pot (from a prior no-winner roll)
 * @returns {{ totalPool, options: Array<{optionId, label, staked, share, multiplier}> }}
 *
 * Multiplier for an option = totalPool / stakedOnThatOption.
 * (If that option wins, its backers split the whole pool in proportion to stake,
 *  so each ₹1 staked returns totalPool/stakedOnOption.)
 * Girls-education cut is applied per-bettor at settlement, not here, so the
 * displayed multiplier is the gross "pool" multiplier.
 */
export function computeLiveOdds(options, rolloverIn = 0) {
  const baseStaked = options.reduce((s, o) => s + o.staked, 0);
  const totalPool  = baseStaked + rolloverIn;

  const withOdds = options.map(o => {
    const multiplier = o.staked > 0 ? +(totalPool / o.staked).toFixed(2) : null; // null = no money yet
    const share      = baseStaked > 0 ? +(o.staked / baseStaked * 100).toFixed(1) : 0;
    return { ...o, multiplier, share };
  });

  return { totalPool: +totalPool.toFixed(2), baseStaked: +baseStaked.toFixed(2), options: withOdds };
}

/**
 * Settle ONE question.
 * @param picks Array<{ id, userId, optionId, stake, girlsEduPct }>
 * @param winningOptionId  the correct option, or null if void
 * @param rolloverIn  pot carried into this question
 * @returns {
 *   payouts: Array<{ pickId, userId, stake, gross, edu, net, isCorrect }>,
 *   eduTotal, rolloverOut, hadWinner
 * }
 *
 * gross = winner's proportional share of the whole pool (stake/winningStake * totalPool)
 * edu   = gross * (their girlsEduPct/100)
 * net   = gross - edu   (credited to balance)
 *
 * If nobody picked the winner (or question is void), hadWinner=false and the
 * entire pool becomes rolloverOut (carried to the next match).
 */
export function settleQuestion(picks, winningOptionId, rolloverIn = 0) {
  const totalStaked = picks.reduce((s, p) => s + p.stake, 0);
  const totalPool   = totalStaked + rolloverIn;

  const winners = picks.filter(p => p.optionId === winningOptionId);
  const winningStake = winners.reduce((s, p) => s + p.stake, 0);

  // No winner → whole pool rolls over
  if (!winningOptionId || winningStake <= 0) {
    return {
      payouts: picks.map(p => ({
        pickId: p.id, userId: p.userId, stake: p.stake,
        gross: 0, edu: 0, net: 0, isCorrect: false
      })),
      eduTotal: 0,
      rolloverOut: +totalPool.toFixed(2),
      hadWinner: false,
      totalPool: +totalPool.toFixed(2)
    };
  }

  let eduTotal = 0;
  const payouts = picks.map(p => {
    const isCorrect = p.optionId === winningOptionId;
    if (!isCorrect) {
      return { pickId: p.id, userId: p.userId, stake: p.stake, gross: 0, edu: 0, net: 0, isCorrect: false };
    }
    const gross = +(p.stake / winningStake * totalPool).toFixed(2);
    const edu   = +(gross * (p.girlsEduPct ?? 5) / 100).toFixed(2);
    const net   = +(gross - edu).toFixed(2);
    eduTotal += edu;
    return { pickId: p.id, userId: p.userId, stake: p.stake, gross, edu, net, isCorrect: true };
  });

  return {
    payouts,
    eduTotal: +eduTotal.toFixed(2),
    rolloverOut: 0,
    hadWinner: true,
    totalPool: +totalPool.toFixed(2)
  };
}
