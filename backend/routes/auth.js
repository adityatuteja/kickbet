// routes/auth.js
import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';

const router = Router();
const prisma = new PrismaClient();
const SECRET = process.env.JWT_SECRET || 'kickbet-secret';

router.post('/register', async (req, res) => {
  const { username, alias, email, password, adminInviteToken } = req.body;
  if (!username || !email || !password)
    return res.status(400).json({ error: 'username, email and password required' });

  // If an admin invite token is supplied, validate it
  let grantAdmin = false;
  let invite = null;
  if (adminInviteToken) {
    invite = await prisma.adminInvite.findUnique({ where: { token: adminInviteToken } });
    if (!invite)                        return res.status(400).json({ error: 'Invalid admin invite' });
    if (invite.status !== 'PENDING')    return res.status(410).json({ error: 'Admin invite is no longer valid' });
    if (new Date() > invite.expiresAt)  return res.status(410).json({ error: 'Admin invite has expired' });
    if (invite.email.toLowerCase() !== email.toLowerCase())
      return res.status(400).json({ error: `This invite is for ${invite.email}. Register with that email.` });
    grantAdmin = true;
  }

  try {
    const hash = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: { username, alias: alias || username, email, password: hash, isAdmin: grantAdmin }
    });

    // Mark invite accepted
    if (invite) {
      await prisma.adminInvite.update({
        where: { id: invite.id },
        data:  { status: 'ACCEPTED', acceptedAt: new Date() }
      });
    }

    const token = jwt.sign({ id: user.id, username: user.username, alias: user.alias, isAdmin: user.isAdmin }, SECRET, { expiresIn: '7d' });
    res.json({ token, user: { id: user.id, username: user.username, alias: user.alias, isAdmin: user.isAdmin, balance: user.balance } });
  } catch (e) {
    if (e.code === 'P2002') return res.status(409).json({ error: 'Username, alias or email already taken' });
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/login', async (req, res) => {
  const { username, password } = req.body;
  const user = await prisma.user.findUnique({ where: { username } });
  if (!user || !(await bcrypt.compare(password, user.password)))
    return res.status(401).json({ error: 'Invalid credentials' });
  const token = jwt.sign({ id: user.id, username: user.username, alias: user.alias, isAdmin: user.isAdmin }, SECRET, { expiresIn: '7d' });
  res.json({ token, user: { id: user.id, username: user.username, alias: user.alias, isAdmin: user.isAdmin, isRootAdmin: user.isRootAdmin, balance: user.balance, committed: user.committed } });
});

router.get('/me', async (req, res) => {
  const header = req.headers.authorization;
  if (!header) return res.status(401).json({ error: 'No token' });
  try {
    const payload = jwt.verify(header.split(' ')[1], SECRET);
    const user = await prisma.user.findUnique({
      where: { id: payload.id },
      select: { id:true, username:true, alias:true, email:true, isAdmin:true, isRootAdmin:true, balance:true, committed:true, girlsEduTotal:true }
    });
    res.json(user);
  } catch { res.status(401).json({ error: 'Invalid token' }); }
});

export default router;
