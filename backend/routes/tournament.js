// routes/tournament.js — tournament-wide bets (parimutuel, settled at the end)
import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { requireAuth, requireAdmin } from '../middleware/auth.js';
import { computeLiveOdds, settleQuestion } from '../lib/parimutuel.js';
import { MATCH_PRESETS, TOURNAMENT_PRESETS } from '../lib/betPresets.js';

const router = Router();
const prisma = new PrismaClient();

// ── GET /api/tournament/presets ───────────────────────────────────────────────
// Returns the preset libraries so the admin UI can offer one-click questions
router.get('/presets', requireAdmin, (req, res) => {
  res.json({ match: MATCH_PRESETS, tournament: TOURNAMENT_PRESETS });
});

// ── GET /api/tournament/questions ─────────────────────────────────────────────
// All open tournament questions with live odds (for the betting page)
router.get('/questions', requireAuth, async (req, res) => {
  const questions = await prisma.question.findMany({
    where:   { scope: 'TOURNAMENT' },
    include: { options: true, betPicks: { select: { optionId:true, stake:true } } },
    orderBy: { order: 'asc' }
  });

  const out = questions.map(q => {
    const totalsByOption = {};
    for (const o of q.options) totalsByOption[o.id] = 0;
    for (const bp of q.betPicks) totalsByOption[bp.optionId] = (totalsByOption[bp.optionId] || 0) + bp.stake;
    const optsArr = q.options.map(o => ({ optionId: o.id, label: o.label, staked: totalsByOption[o.id] || 0 }));
    const odds = computeLiveOdds(optsArr, 0);
    return {
      questionId: q.id,
      text:       q.text,
      minStake:   q.minStake,
      settled:    q.settled,
      closesAt:   q.closesAt,
      totalPool:  odds.totalPool,
      options:    odds.options,
    };
  });

  res.json(out);
});

// ── POST /api/tournament/bet ──────────────────────────────────────────────────
// Place/replace a bet on a single tournament question (one bet per user per question)
router.post('/bet', requireAuth, async (req, res) => {
  const { questionId, optionId, amount, girlsEduPct = 5 } = req.body;
  const amt = parseFloat(amount);
  if (!questionId || !optionId || !amt || amt <= 0)
    return res.status(400).json({ error: 'questionId, optionId and a positive amount are required' });

  const pct = Math.min(100, Math.max(0, Number(girlsEduPct) || 0));

  const q = await prisma.question.findUnique({
    where: { id: questionId }, include: { options: true }
  });
  if (!q || q.scope !== 'TOURNAMENT') return res.status(404).json({ error: 'Tournament question not found' });
  if (q.settled) return res.status(400).json({ error: 'This question is already settled' });
  if (q.closesAt && new Date() > q.closesAt) return res.status(400).json({ error: 'Betting has closed for this question' });
  if (amt < (q.minStake ?? 10)) return res.status(400).json({ error: `Minimum love is ♡ ${q.minStake ?? 10} LB` });
  if (!q.options.find(o => o.id === optionId)) return res.status(400).json({ error: 'Invalid option' });

  const user = await prisma.user.findUnique({ where: { id: req.user.id } });
  const available = user.balance - user.committed;

  const existing = await prisma.bet.findUnique({
    where: { userId_tournamentQuestionId: { userId: req.user.id, tournamentQuestionId: questionId } }
  });
  const prevStake = existing ? existing.totalStake : 0;
  const delta = amt - prevStake;
  if (delta > available)
    return res.status(400).json({ error: `Insufficient balance. Available: ♡ ${available.toFixed(2)} LB` });

  await prisma.$transaction(async (tx) => {
    if (existing) {
      await tx.betPick.deleteMany({ where: { betId: existing.id } });
      await tx.user.update({ where: { id: req.user.id }, data: { committed: { decrement: existing.totalStake } } });
    }
    const b = await tx.bet.upsert({
      where:  { userId_tournamentQuestionId: { userId: req.user.id, tournamentQuestionId: questionId } },
      update: { totalStake: amt, girlsEduPct: pct, status: 'PENDING' },
      create: { userId: req.user.id, tournamentQuestionId: questionId, scope: 'TOURNAMENT', totalStake: amt, girlsEduPct: pct }
    });
    await tx.betPick.create({
      data: { betId: b.id, questionId, optionId, stake: amt, potentialWin: 0 }
    });
    await tx.user.update({ where: { id: req.user.id }, data: { committed: { increment: amt } } });
  });

  res.json({ ok: true, note: 'Tournament payouts are parimutuel — settled when the tournament ends.' });
});

// ── GET /api/tournament/my ────────────────────────────────────────────────────
router.get('/my', requireAuth, async (req, res) => {
  const bets = await prisma.bet.findMany({
    where:   { userId: req.user.id, scope: 'TOURNAMENT' },
    include: { picks: { include: { question: true, option: true } } },
    orderBy: { createdAt: 'desc' }
  });
  res.json(bets);
});

// ── ADMIN: POST /api/tournament/questions ─────────────────────────────────────
// Create a tournament question: { text, minStake, options:[label], closesAt? }
router.post('/questions', requireAdmin, async (req, res) => {
  try {
    const { text, minStake, options, closesAt } = req.body;
    const valid = (options || []).filter(o => o && o.trim());
    if (!text || valid.length < 2)
      return res.status(400).json({ error: 'A question and at least 2 options are required' });

    const count = await prisma.question.count({ where: { scope: 'TOURNAMENT' } });
    const q = await prisma.question.create({
      data: {
        scope:    'TOURNAMENT',
        text,
        order:    count + 1,
        minStake: Number(minStake) || 50,
        closesAt: closesAt ? new Date(closesAt) : null,
        options:  { create: valid.map(label => ({ label: label.trim() })) }
      },
      include: { options: true }
    });
    res.json(q);
  } catch (e) {
    console.error('Create tournament question failed:', e);
    res.status(500).json({ error: e.message });
  }
});

// ── ADMIN: DELETE /api/tournament/questions/:id ───────────────────────────────
router.delete('/questions/:id', requireAdmin, async (req, res) => {
  try {
    const betCount = await prisma.betPick.count({ where: { questionId: req.params.id } });
    if (betCount > 0)
      return res.status(409).json({ error: 'Bets exist on this question — it cannot be deleted.' });
    await prisma.option.deleteMany({ where: { questionId: req.params.id } });
    await prisma.question.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── ADMIN: POST /api/tournament/questions/:id/settle ──────────────────────────
// Body: { winningOptionId } (or null to void → rolls nothing, refunds via parimutuel rules)
router.post('/questions/:id/settle', requireAdmin, async (req, res) => {
  try {
    const { winningOptionId } = req.body;
    const q = await prisma.question.findUnique({
      where: { id: req.params.id },
      include: { options: true, betPicks: { include: { bet: true } } }
    });
    if (!q || q.scope !== 'TOURNAMENT') return res.status(404).json({ error: 'Tournament question not found' });
    if (q.settled) return res.status(400).json({ error: 'Already settled' });

    const picks = q.betPicks.map(bp => ({
      id: bp.id, userId: bp.bet.userId, optionId: bp.optionId,
      stake: bp.stake, girlsEduPct: bp.bet.girlsEduPct ?? 5,
    }));

    const result = settleQuestion(picks, winningOptionId || null, 0);

    await prisma.$transaction(async (tx) => {
      for (const p of result.payouts) {
        await tx.betPick.update({
          where: { id: p.pickId },
          data:  { isCorrect: p.isCorrect, actualWin: p.gross, eduTaken: p.edu }
        });
        // release stake, credit net winnings, record edu
        await tx.user.update({
          where: { id: p.userId },
          data: {
            committed:     { decrement: p.stake },
            balance:       { increment: p.net },
            girlsEduTotal: { increment: p.edu }
          }
        });
        if (p.edu > 0)
          await tx.donation.create({ data: { userId: p.userId, amount: p.edu, source: 'tournament_winnings' } });
        // mark the parent bet's status
        const bet = q.betPicks.find(bp => bp.id === p.pickId)?.bet;
        if (bet) await tx.bet.update({ where: { id: bet.id }, data: { status: p.isCorrect ? 'WON' : 'LOST' } });
      }
      if (winningOptionId)
        await tx.option.update({ where: { id: winningOptionId }, data: { isWinner: true } }).catch(()=>{});
      await tx.question.update({ where: { id: req.params.id }, data: { settled: true } });
    });

    res.json({ ok: true, settled: result.payouts.length, hadWinner: result.hadWinner });
  } catch (e) {
    console.error('Tournament settle failed:', e);
    res.status(500).json({ error: e.message });
  }
});

export default router;
