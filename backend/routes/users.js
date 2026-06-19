// routes/users.js
import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { requireAuth } from '../middleware/auth.js';

const router = Router();
const prisma = new PrismaClient();

// Public leaderboard — aliases only, no real names/emails
router.get('/leaderboard', requireAuth, async (req, res) => {
  const users = await prisma.user.findMany({
    select: { id:true, alias:true, balance:true, committed:true, girlsEduTotal:true },
    orderBy: { girlsEduTotal: 'desc' }
  });
  res.json(users);
});

// Girls ed full breakdown
router.get('/girls-edu', requireAuth, async (req, res) => {
  const users = await prisma.user.findMany({
    select: { id:true, alias:true, girlsEduTotal:true, balance:true, committed:true },
    orderBy: { girlsEduTotal: 'desc' }
  });
  const total = users.reduce((s, u) => s + u.girlsEduTotal, 0);
  const donations = await prisma.donation.findMany({
    orderBy: { createdAt: 'asc' },
    select: { amount:true, createdAt:true, user:{ select:{ alias:true } } }
  });
  res.json({ users, total, donations });
});

export default router;
