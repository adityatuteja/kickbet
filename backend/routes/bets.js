// routes/bets.js
import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { requireAuth } from '../middleware/auth.js';
import { computeLiveOdds } from '../lib/parimutuel.js';

const router = Router();
const prisma = new PrismaClient();

router.post('/', requireAuth, async (req, res) => {
  const { matchId, picks, girlsEduPct = 5 } = req.body;
  // picks: [{ questionId, optionId, amount }]
  if (!matchId || !picks?.length)
    return res.status(400).json({ error: 'matchId and picks required' });

  const pct = Math.min(100, Math.max(0, Number(girlsEduPct) || 0));

  const match = await prisma.match.findUnique({
    where: { id: matchId },
    include: { questions: { include: { options: true } } }
  });
  if (!match) return res.status(404).json({ error: 'Match not found' });
  if (match.status !== 'BETTING_OPEN')
    return res.status(400).json({ error: 'Betting is not open for this match' });
  if (new Date() > match.bettingClosesAt)
    return res.status(400).json({ error: 'Betting has closed for this match' });

  // Validate amounts against each question's minStake
  for (const p of picks) {
    const amt = parseFloat(p.amount);
    if (!amt || amt <= 0) return res.status(400).json({ error: 'Each love must have a positive amount' });
    const q = match.questions.find(q => q.id === p.questionId);
    if (!q) return res.status(400).json({ error: 'Invalid question' });
    if (amt < (q.minStake ?? 10))
      return res.status(400).json({ error: `Minimum love for "${q.text}" is ♡ ${q.minStake ?? 10} LB` });
  }

  const user = await prisma.user.findUnique({ where: { id: req.user.id } });
  const available = user.balance - user.committed;

  const totalStake = +picks.reduce((s, p) => s + parseFloat(p.amount), 0).toFixed(2);

  const existingBet = await prisma.bet.findUnique({
    where: { userId_matchId: { userId: req.user.id, matchId } },
    include: { picks: true }
  });
  const prevStake = existingBet ? existingBet.totalStake : 0;
  const delta     = totalStake - prevStake;

  if (delta > available)
    return res.status(400).json({ error: `Insufficient balance. Available: ♡ ${available.toFixed(2)} LB` });

  // Compute a LIVE projected payout for each pick (informational only — final is set at settlement)
  // We need current staked totals per option to project.
  const allQIds = match.questions.map(q => q.id);
  const existingPicks = await prisma.betPick.findMany({
    where: { questionId: { in: allQIds } },
    select: { questionId: true, optionId: true, stake: true, betId: true }
  });

  const bet = await prisma.$transaction(async (tx) => {
    if (existingBet) {
      await tx.betPick.deleteMany({ where: { betId: existingBet.id } });
      await tx.user.update({
        where: { id: req.user.id },
        data:  { committed: { decrement: existingBet.totalStake } }
      });
    }

    const b = await tx.bet.upsert({
      where:  { userId_matchId: { userId: req.user.id, matchId } },
      update: { totalStake, girlsEduPct: pct, status: 'PENDING' },
      create: { userId: req.user.id, matchId, totalStake, girlsEduPct: pct }
    });

    // Build projected odds INCLUDING this user's new stakes (so the projection reflects their entry)
    const pickData = picks.map(p => {
      const q = match.questions.find(q => q.id === p.questionId);
      const stake = parseFloat(p.amount);

      // staked on this option by others (exclude this user's prior bet which we just deleted)
      const others = existingPicks
        .filter(x => x.optionId === p.optionId && x.betId !== (existingBet?.id))
        .reduce((s, x) => s + x.stake, 0);

      // total staked across the question by others + this user's new stake on this option
      const optionTotals = {};
      for (const o of q.options) optionTotals[o.id] = 0;
      for (const x of existingPicks) {
        if (x.questionId === q.id && x.betId !== (existingBet?.id))
          optionTotals[x.optionId] = (optionTotals[x.optionId] || 0) + x.stake;
      }
      optionTotals[p.optionId] = (optionTotals[p.optionId] || 0) + stake;

      const optsArr = q.options.map(o => ({ optionId: o.id, label: o.label, staked: optionTotals[o.id] || 0 }));
      const rolloverPerQ = (match.rolloverIn || 0) / Math.max(1, match.questions.length);
      const odds = computeLiveOdds(optsArr, rolloverPerQ);
      const mine = odds.options.find(o => o.optionId === p.optionId);
      const projWin = mine?.multiplier ? +(stake * mine.multiplier).toFixed(2) : stake;

      return {
        betId:        b.id,
        questionId:   p.questionId,
        optionId:     p.optionId,
        stake,
        potentialWin: projWin,   // live projection
      };
    });

    await tx.betPick.createMany({ data: pickData });
    await tx.user.update({
      where: { id: req.user.id },
      data:  { committed: { increment: totalStake } }
    });

    return b;
  });

  res.json({
    bet,
    totalStake,
    girlsEduPct: pct,
    note: 'Payouts are parimutuel — final multiplier is locked when loving closes.'
  });
});

router.get('/my', requireAuth, async (req, res) => {
  const bets = await prisma.bet.findMany({
    where:   { userId: req.user.id, matchId: { not: null } },  // match bets only; tournament bets live on /tournament/my
    include: {
      match: true,
      picks: { include: { question: true, option: true } }
    },
    orderBy: { createdAt: 'desc' }
  });
  res.json(bets);
});

export default router;
