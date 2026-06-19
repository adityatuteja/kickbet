// routes/donations.js
import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { requireAuth } from '../middleware/auth.js';

const router = Router();
const prisma = new PrismaClient();

// Direct donation
router.post('/', requireAuth, async (req, res) => {
  const { amount } = req.body;
  if (!amount || amount <= 0) return res.status(400).json({ error: 'Invalid amount' });
  const user = await prisma.user.findUnique({ where: { id: req.user.id } });
  const available = user.balance - user.committed;
  if (amount > available) return res.status(400).json({ error: 'Insufficient balance' });

  await prisma.$transaction([
    prisma.user.update({ where: { id: req.user.id }, data: { balance: { decrement: amount }, girlsEduTotal: { increment: amount } } }),
    prisma.donation.create({ data: { userId: req.user.id, amount, source: 'direct' } })
  ]);
  res.json({ ok: true });
});

export default router;
