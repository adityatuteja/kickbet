// routes/pool.js
import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { requireAuth, requireAdmin } from '../middleware/auth.js';

const router = Router();
const prisma  = new PrismaClient();
const MIN_COMMITMENT = 2000;

// ── GET /api/pool ─────────────────────────────────────────────────────────────
router.get('/', requireAuth, async (req, res) => {
  const commitments = await prisma.poolCommitment.findMany({
    include: {
      user: { select: { id:true, alias:true, balance:true, committed:true, girlsEduTotal:true } },
      transactions: { orderBy: { createdAt: 'asc' } }
    },
    orderBy: { totalCommitted: 'desc' }
  });

  // Hydrate payment methods used in pledges
  const methodIds = [...new Set(commitments.flatMap(c => c.transactions.map(t => t.paymentMethodId)).filter(Boolean))];
  const methods = methodIds.length
    ? await prisma.paymentMethod.findMany({ where: { id: { in: methodIds } } })
    : [];
  const methodById = Object.fromEntries(methods.map(m => [m.id, m]));
  for (const c of commitments)
    for (const t of c.transactions)
      if (t.paymentMethodId) t.paymentMethod = methodById[t.paymentMethodId] || null;

  const transfers = await prisma.poolTransfer.findMany({
    orderBy: { createdAt: 'desc' }, take: 30,
    include: { fromUser:{ select:{ alias:true } }, toUser:{ select:{ alias:true } } }
  });

  const allUsers = await prisma.user.findMany({
    where:  { isAdmin: false },
    select: { id:true, alias:true, balance:true, committed:true, girlsEduTotal:true }
  });

  // Admins are the only valid transfer recipients
  const admins = await prisma.user.findMany({
    where:  { isAdmin: true },
    select: { id:true, alias:true }
  });

  const totalCommitted        = commitments.reduce((s,c) => s + c.totalCommitted, 0);
  const totalConfirmed        = commitments.reduce((s,c) => s + c.totalConfirmed, 0);
  const pendingConfirmation   = totalCommitted - totalConfirmed;

  res.json({ commitments, transfers, allUsers, admins, totalCommitted, totalConfirmed, pendingConfirmation });
});

// ── POST /api/pool/pledge ─────────────────────────────────────────────────────
// User commits money to the pool (min ♡ 2,000 first time)
router.post('/pledge', requireAuth, async (req, res) => {
  const { amount, note, paymentMethodId } = req.body;
  const amt = parseFloat(amount);
  if (!amt || amt <= 0) return res.status(400).json({ error: 'Enter a valid amount' });

  const commitment = await prisma.poolCommitment.findUnique({ where: { userId: req.user.id } });
  if (!commitment && amt < MIN_COMMITMENT)
    return res.status(400).json({ error: `Minimum first commitment is ♡ ${MIN_COMMITMENT.toLocaleString('en-IN')} LB` });

  const updated = await prisma.$transaction(async (tx) => {
    const c = await tx.poolCommitment.upsert({
      where:  { userId: req.user.id },
      update: { totalCommitted: { increment: amt } },
      create: { userId: req.user.id, totalCommitted: amt, totalConfirmed: 0 }
    });
    await tx.poolTransaction.create({
      data: {
        commitmentId:    c.id,
        type:            'USER_PLEDGE',
        amount:          amt,
        receiptStatus:   'PENDING',
        paymentMethodId: paymentMethodId || null,
        note:            note || ''
      }
    });
    return c;
  });

  res.json({ ok:true, totalCommitted: updated.totalCommitted, totalConfirmed: updated.totalConfirmed });
});

// ── POST /api/pool/acknowledge ────────────────────────────────────────────────
// Admin acknowledges each pledge transaction individually:
// status: RECEIVED | PARTIAL | NOT_RECEIVED
// amountReceived: required for RECEIVED / PARTIAL
router.post('/acknowledge', requireAdmin, async (req, res) => {
  const { transactionId, status, amountReceived, adminNote } = req.body;

  if (!transactionId || !status)
    return res.status(400).json({ error: 'transactionId and status required' });
  if (!['RECEIVED','PARTIAL','NOT_RECEIVED'].includes(status))
    return res.status(400).json({ error: 'status must be RECEIVED, PARTIAL, or NOT_RECEIVED' });

  const txn = await prisma.poolTransaction.findUnique({
    where:   { id: transactionId },
    include: { commitment: true }
  });
  if (!txn) return res.status(404).json({ error: 'Transaction not found' });
  if (txn.type !== 'USER_PLEDGE')
    return res.status(400).json({ error: 'Can only acknowledge user pledges' });

  const received = status === 'NOT_RECEIVED' ? 0 : parseFloat(amountReceived) || 0;
  if ((status === 'RECEIVED' || status === 'PARTIAL') && received <= 0)
    return res.status(400).json({ error: 'amountReceived required for RECEIVED / PARTIAL' });

  // Reverse any previous acknowledgement on this transaction
  const prevReceived = txn.amountReceived || 0;
  const delta        = received - prevReceived;

  await prisma.$transaction(async (tx) => {
    // Update the pledge transaction itself
    await tx.poolTransaction.update({
      where: { id: transactionId },
      data:  { receiptStatus: status, amountReceived: received, adminNote: adminNote || '' }
    });

    // Update the commitment totals
    await tx.poolCommitment.update({
      where: { id: txn.commitmentId },
      data:  { totalConfirmed: { increment: delta } }
    });

    // Credit / debit balance
    if (delta !== 0) {
      await tx.user.update({
        where: { id: txn.commitment.userId },
        data:  { balance: { increment: delta } }
      });
    }

    // Log an ADMIN_CONFIRMED transaction if money was actually received
    if (received > 0 && delta > 0) {
      await tx.poolTransaction.create({
        data: {
          commitmentId:  txn.commitmentId,
          type:          'ADMIN_CONFIRMED',
          amount:        delta,
          receiptStatus: 'RECEIVED',
          note:          adminNote || 'Admin acknowledged'
        }
      });
    }
  });

  res.json({ ok: true, status, amountReceived: received });
});

// ── POST /api/pool/transfer ───────────────────────────────────────────────────
router.post('/transfer', requireAuth, async (req, res) => {
  const { toUserId, amount, note } = req.body;
  const amt = parseFloat(amount);
  if (!toUserId || !amt || amt <= 0)
    return res.status(400).json({ error: 'toUserId and positive amount required' });
  if (toUserId === req.user.id)
    return res.status(400).json({ error: 'Cannot transfer to yourself' });

  const sender = await prisma.user.findUnique({ where: { id: req.user.id } });
  const avail  = sender.balance - sender.committed;
  if (amt > avail)
    return res.status(400).json({ error: `Insufficient available balance. You have ♡ ${avail.toFixed(2)} LB` });

  const recipient = await prisma.user.findUnique({ where: { id: toUserId } });
  if (!recipient) return res.status(404).json({ error: 'Recipient not found' });
  if (!recipient.isAdmin)
    return res.status(403).json({ error: 'You can only transfer money to an admin' });

  await prisma.$transaction([
    prisma.user.update({ where:{ id: req.user.id }, data:{ balance:{ decrement: amt } } }),
    prisma.user.update({ where:{ id: toUserId },    data:{ balance:{ increment: amt } } }),
    prisma.poolTransfer.create({ data:{ fromUserId: req.user.id, toUserId, amount: amt, note: note||'' } })
  ]);

  res.json({ ok:true, to: recipient.alias, amount: amt });
});

export default router;
