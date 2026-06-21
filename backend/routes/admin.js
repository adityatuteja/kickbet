// routes/admin.js
import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { requireAdmin, requireRootAdmin } from '../middleware/auth.js';
import { sendMatchNotification, sendResultNotification } from '../lib/mailer.js';
import { settleQuestion } from '../lib/parimutuel.js';
import { MATCH_PRESETS, applyTeamNames } from '../lib/betPresets.js';

const router = Router();
const prisma = new PrismaClient();

// Create a match
router.post('/matches', requireAdmin, async (req, res) => {
  const { homeTeam, awayTeam, homeFlag, awayFlag, kickoffAt, stage } = req.body;
  const kick = new Date(kickoffAt);
  const bettingOpensAt  = new Date(kick.getTime() - 12*60*60*1000);
  const bettingClosesAt = new Date(kick.getTime() - 30*60*1000);
  const match = await prisma.match.create({
    data: { homeTeam, awayTeam, homeFlag: homeFlag||'🏳️', awayFlag: awayFlag||'🏳️', kickoffAt: kick, bettingOpensAt, bettingClosesAt, stage: stage||'Group Stage' }
  });
  res.json(match);
});

// Update match status
router.patch('/matches/:id/status', requireAdmin, async (req, res) => {
  const match = await prisma.match.update({ where: { id: req.params.id }, data: { status: req.body.status } });
  res.json(match);
});

// Add/update questions for a match + notify users
router.put('/matches/:id/questions', requireAdmin, async (req, res) => {
  try {
    const { questions } = req.body;
    // questions: [{ text, order, minStake, options:[{label}] }]

    // Block destructive edits once bets exist on this match — would orphan/zero out real stakes
    const betCount = await prisma.bet.count({ where: { matchId: req.params.id } });
    if (betCount > 0) {
      return res.status(409).json({
        error: 'Bets have already been placed on this match, so its questions can\'t be changed. Create a new match instead.'
      });
    }

    // Safe to replace: delete picks → options → questions, then recreate
    await prisma.$transaction(async (tx) => {
      const qs = await tx.question.findMany({ where: { matchId: req.params.id }, select: { id: true } });
      const qIds = qs.map(q => q.id);
      if (qIds.length) {
        await tx.betPick.deleteMany({ where: { questionId: { in: qIds } } });
        await tx.option.deleteMany({ where: { questionId: { in: qIds } } });
        await tx.question.deleteMany({ where: { matchId: req.params.id } });
      }
      for (const q of questions) {
        const validOptions = (q.options || []).filter(o => o.label && o.label.trim());
        if (validOptions.length < 2) continue; // need at least 2 options
        await tx.question.create({
          data: {
            matchId:  req.params.id,
            text:     q.text,
            order:    q.order,
            minStake: Number(q.minStake) || 10,
            options:  { create: validOptions.map(o => ({ label: o.label.trim() })) }
          }
        });
      }
    });

    const match = await prisma.match.findUnique({ where: { id: req.params.id } });
    const users = await prisma.user.findMany({ select: { email:true, alias:true } });
    for (const u of users) {
      await sendMatchNotification(u.email, u.alias, match).catch(console.error);
    }
    res.json({ ok: true, notified: users.length });
  } catch (e) {
    console.error('PUT /questions failed:', e);
    res.status(500).json({ error: 'Could not save questions: ' + e.message });
  }
});

// Promote user to admin
// Get match-question presets, with team names filled in for a given match
router.get('/matches/:id/presets', requireAdmin, async (req, res) => {
  const match = await prisma.match.findUnique({ where: { id: req.params.id } });
  if (!match) return res.status(404).json({ error: 'Match not found' });
  const presets = MATCH_PRESETS.map(p => applyTeamNames(p, match.homeTeam, match.awayTeam));
  res.json(presets);
});

router.post('/promote', requireRootAdmin, async (req, res) => {
  const { username } = req.body;
  const user = await prisma.user.update({ where: { username }, data: { isAdmin: true } });
  res.json({ ok: true, alias: user.alias });
});

// Demote admin (root admin only; cannot demote the root admin)
router.post('/demote', requireRootAdmin, async (req, res) => {
  const { username } = req.body;
  const target = await prisma.user.findUnique({ where: { username } });
  if (!target) return res.status(404).json({ error: 'User not found' });
  if (target.isRootAdmin) return res.status(403).json({ error: 'Cannot demote the root admin' });
  const user = await prisma.user.update({ where: { username }, data: { isAdmin: false } });
  res.json({ ok: true, alias: user.alias });
});

// List all admins
router.get('/admins', requireAdmin, async (req, res) => {
  const admins = await prisma.user.findMany({ where: { isAdmin: true }, select: { id:true, username:true, alias:true, isRootAdmin:true } });
  res.json(admins);
});

// All users (admin view with real data)
router.get('/users', requireAdmin, async (req, res) => {
  const users = await prisma.user.findMany({
    select: { id:true, username:true, alias:true, email:true, balance:true, committed:true, girlsEduTotal:true, isAdmin:true, createdAt:true }
  });
  res.json(users);
});

// Settle match results
// correctOptions: { [questionId]: optionId }
router.post('/matches/:id/settle', requireAdmin, async (req, res) => {
  const { correctOptions } = req.body;
  // correctOptions = { questionId: winningOptionId | null (void), ... }
  if (!correctOptions || !Object.keys(correctOptions).length)
    return res.status(400).json({ error: 'correctOptions required: { questionId: winningOptionId }' });

  const match = await prisma.match.findUnique({
    where: { id: req.params.id },
    include: {
      questions: { include: { options: true, betPicks: { include: { bet: true } } } },
      bets: { include: { user: true, picks: { include: { question: true, option: true } } } }
    }
  });
  if (!match) return res.status(404).json({ error: 'Match not found' });

  const rolloverPerQ = (match.rolloverIn || 0) / Math.max(1, match.questions.length);

  // ── Settle each question with parimutuel math ──────────────────────
  // Accumulate per-user totals across all questions in this match.
  const userTotals = {}; // userId -> { gross, edu, net, stake, wonCount, lostCount }
  let matchRolloverOut = 0;
  const questionResults = [];

  for (const q of match.questions) {
    const winningOptionId = correctOptions[q.id] || null; // null = void/no correct answer

    // Build picks with each bettor's girlsEduPct (from their bet)
    const picks = q.betPicks.map(bp => ({
      id: bp.id,
      userId: bp.bet.userId,
      optionId: bp.optionId,
      stake: bp.stake,
      girlsEduPct: bp.bet.girlsEduPct ?? 5,
    }));

    const result = settleQuestion(picks, winningOptionId, rolloverPerQ);
    questionResults.push({ questionId: q.id, winningOptionId, ...result });

    if (!result.hadWinner) {
      matchRolloverOut += result.rolloverOut;
    }

    for (const p of result.payouts) {
      if (!userTotals[p.userId]) userTotals[p.userId] = { gross:0, edu:0, net:0, stake:0, wonCount:0, lostCount:0 };
      const ut = userTotals[p.userId];
      ut.gross += p.gross;
      ut.edu   += p.edu;
      ut.net   += p.net;
      ut.stake += p.stake;
      if (p.isCorrect) ut.wonCount++; else ut.lostCount++;
    }
  }

  const summary = [];

  await prisma.$transaction(async (tx) => {
    // Write per-pick results
    for (const qr of questionResults) {
      for (const p of qr.payouts) {
        await tx.betPick.update({
          where: { id: p.pickId },
          data:  {
            isCorrect: p.isCorrect,
            actualWin: p.gross,
            eduTaken:  p.edu,
          }
        });
      }
      // Flag winning option + mark question settled
      if (qr.winningOptionId) {
        await tx.option.update({ where: { id: qr.winningOptionId }, data: { isWinner: true } }).catch(() => {});
      }
      await tx.question.update({ where: { id: qr.questionId }, data: { settled: true } }).catch(() => {});
    }

    // Apply per-user balance changes
    for (const bet of match.bets) {
      const ut = userTotals[bet.userId] || { gross:0, edu:0, net:0, stake:bet.totalStake, wonCount:0, lostCount:0 };

      const betStatus = ut.wonCount > 0 && ut.lostCount === 0 ? 'WON'
                      : ut.wonCount === 0                     ? 'LOST'
                      : 'PARTIAL';

      await tx.bet.update({ where: { id: bet.id }, data: { status: betStatus } });

      // Release committed stake, credit net winnings, record edu
      await tx.user.update({
        where: { id: bet.userId },
        data: {
          committed:     { decrement: bet.totalStake },
          balance:       { increment: ut.net },
          girlsEduTotal: { increment: ut.edu }
        }
      });

      if (ut.edu > 0) {
        await tx.donation.create({ data: { userId: bet.userId, amount: ut.edu, source: 'bet_winnings' } });
      }

      summary.push({
        userId:      bet.userId,
        alias:       bet.user.alias,
        email:       bet.user.email,
        betStatus,
        totalStaked: bet.totalStake,
        totalWon:    +ut.gross.toFixed(2),
        eduDonated:  +ut.edu.toFixed(2),
        netWinnings: +ut.net.toFixed(2),
        newBalance:  +(bet.user.balance - bet.totalStake + ut.net).toFixed(2),
        won:  bet.picks.filter(p => correctOptions[p.questionId] === p.optionId)
                       .map(p => ({ question: p.question.text, pick: p.option.label })),
        lost: bet.picks.filter(p => correctOptions[p.questionId] !== p.optionId)
                       .map(p => ({ question: p.question.text, pick: p.option.label, staked: p.stake })),
      });
    }

    // Mark match completed
    await tx.match.update({ where: { id: req.params.id }, data: { status: 'COMPLETED' } });

    // Roll any no-winner pots into the NEXT upcoming match
    if (matchRolloverOut > 0) {
      const nextMatch = await tx.match.findFirst({
        where: { status: { in: ['UPCOMING','BETTING_OPEN'] }, id: { not: req.params.id } },
        orderBy: { kickoffAt: 'asc' }
      });
      if (nextMatch) {
        await tx.match.update({
          where: { id: nextMatch.id },
          data:  { rolloverIn: { increment: +matchRolloverOut.toFixed(2) } }
        });
      }
      // if no next match, the rollover stays recorded in summary; admin can carry it manually later
    }
  });

  // Result emails
  for (const s of summary) {
    await sendResultNotification(s.email, s.alias, match, s).catch(console.error);
  }

  res.json({
    ok: true,
    settled: summary.length,
    rolloverOut: +matchRolloverOut.toFixed(2),
    summary
  });
});

// Get match results (for results page)
router.get('/matches/:id/results', async (req, res) => {
  const match = await prisma.match.findUnique({
    where: { id: req.params.id },
    include: {
      questions: { include: { options: true } },
      bets: {
        include: {
          user: { select: { alias: true } },
          picks: { include: { question: true, option: true } }
        }
      }
    }
  });
  if (!match) return res.status(404).json({ error: 'Not found' });
  res.json(match);
});

export default router;
