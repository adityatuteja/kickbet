// routes/matches.js
import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { requireAuth } from '../middleware/auth.js';
import { computeLiveOdds } from '../lib/parimutuel.js';

const router = Router();
const prisma = new PrismaClient();

// Attach live parimutuel odds to each question of a match
async function hydrateMatchWithOdds(match) {
  // Gather all staked amounts per option across the match in one query
  const questionIds = match.questions.map(q => q.id);
  const picks = questionIds.length
    ? await prisma.betPick.findMany({
        where: { questionId: { in: questionIds } },
        select: { questionId: true, optionId: true, stake: true }
      })
    : [];

  // index: questionId -> optionId -> staked
  const stakeMap = {};
  for (const p of picks) {
    stakeMap[p.questionId] ??= {};
    stakeMap[p.questionId][p.optionId] = (stakeMap[p.questionId][p.optionId] || 0) + p.stake;
  }

  const questions = match.questions.map(q => {
    const opts = q.options.map(o => ({
      optionId: o.id,
      label: o.label,
      minStake: q.minStake ?? o.price ?? 10,
      staked: stakeMap[q.id]?.[o.id] || 0,
    }));
    // rolloverIn applies at the match level; spread evenly across questions for display
    const rolloverPerQ = (match.rolloverIn || 0) / Math.max(1, match.questions.length);
    const odds = computeLiveOdds(opts, rolloverPerQ);
    return {
      id: q.id,
      text: q.text,
      order: q.order,
      minStake: q.minStake ?? 10,
      settled: q.settled,
      totalPool: odds.totalPool,
      options: q.options.map(o => {
        const live = odds.options.find(x => x.optionId === o.id);
        return {
          id: o.id,
          label: o.label,
          minStake: q.minStake ?? o.price ?? 10,
          isWinner: o.isWinner,
          staked: live?.staked || 0,
          share: live?.share || 0,
          liveMultiplier: live?.multiplier,  // null if no love yet
        };
      })
    };
  });

  return { ...match, questions };
}

router.get('/', requireAuth, async (req, res) => {
  const matches = await prisma.match.findMany({
    orderBy: { kickoffAt: 'asc' },
    include: { questions: { orderBy: { order: 'asc' }, include: { options: true } } }
  });
  const hydrated = await Promise.all(matches.map(hydrateMatchWithOdds));
  res.json(hydrated);
});

router.get('/:id', requireAuth, async (req, res) => {
  const match = await prisma.match.findUnique({
    where: { id: req.params.id },
    include: { questions: { orderBy: { order: 'asc' }, include: { options: true } } }
  });
  if (!match) return res.status(404).json({ error: 'Not found' });
  res.json(await hydrateMatchWithOdds(match));
});

// Live distribution stats for charts (per-option staked + live multiplier)
router.get('/:id/stats', requireAuth, async (req, res) => {
  const match = await prisma.match.findUnique({
    where: { id: req.params.id },
    include: { questions: { include: { options: { include: { betPicks: true } } } } }
  });
  if (!match) return res.status(404).json({ error: 'Not found' });

  const rolloverPerQ = (match.rolloverIn || 0) / Math.max(1, match.questions.length);

  const stats = match.questions.map(q => {
    const opts = q.options.map(o => ({
      optionId: o.id, label: o.label,
      staked: o.betPicks.reduce((s, p) => s + p.stake, 0),
      count: o.betPicks.length
    }));
    const odds = computeLiveOdds(opts, rolloverPerQ);
    return {
      questionId: q.id,
      text: q.text,
      totalPool: odds.totalPool,
      options: odds.options.map(o => ({
        optionId: o.optionId,
        label: o.label,
        count: opts.find(x => x.optionId === o.optionId)?.count || 0,
        staked: o.staked,
        totalStaked: o.staked,
        share: o.share,
        multiplier: o.multiplier
      }))
    };
  });
  res.json(stats);
});

export default router;
