// routes/invites.js
import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';
import { requireRootAdmin } from '../middleware/auth.js';
import { sendAdminInvite } from '../lib/mailer.js';

const router = Router();
const prisma = new PrismaClient();

const INVITE_TTL_DAYS = 7;

// ── Root admin: create an invite ──────────────────────────────────────────────
router.post('/', requireRootAdmin, async (req, res) => {
  const { email } = req.body;
  if (!email || !/^[^@]+@[^@]+\.[^@]+$/.test(email))
    return res.status(400).json({ error: 'Valid email required' });

  // Already an admin?
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing?.isAdmin)
    return res.status(409).json({ error: 'That email already belongs to an admin' });

  // Revoke any prior pending invite for this email
  await prisma.adminInvite.updateMany({
    where: { email, status: 'PENDING' },
    data:  { status: 'REVOKED' }
  });

  const token = crypto.randomBytes(24).toString('hex');
  const expiresAt = new Date(Date.now() + INVITE_TTL_DAYS * 24 * 60 * 60 * 1000);

  const invite = await prisma.adminInvite.create({
    data: { email, token, createdById: req.user.id, expiresAt }
  });

  // Build the signup link
  const base = (process.env.FRONTEND_URL || 'http://localhost:5173').split(',')[0];
  const link = `${base}/?adminInvite=${token}`;

  // Email it (no-op if SMTP unconfigured)
  await sendAdminInvite(email, link, expiresAt).catch(console.error);

  res.json({ ok: true, invite: { id: invite.id, email, token, link, expiresAt } });
});

// ── Root admin: list all invites ──────────────────────────────────────────────
router.get('/', requireRootAdmin, async (req, res) => {
  // Auto-expire stale invites
  await prisma.adminInvite.updateMany({
    where: { status: 'PENDING', expiresAt: { lt: new Date() } },
    data:  { status: 'EXPIRED' }
  });

  const invites = await prisma.adminInvite.findMany({
    orderBy: { createdAt: 'desc' },
    include: { createdBy: { select: { alias: true } } }
  });
  const base = (process.env.FRONTEND_URL || 'http://localhost:5173').split(',')[0];
  res.json(invites.map(i => ({ ...i, link: `${base}/?adminInvite=${i.token}` })));
});

// ── Root admin: revoke an invite ──────────────────────────────────────────────
router.post('/:id/revoke', requireRootAdmin, async (req, res) => {
  await prisma.adminInvite.update({
    where: { id: req.params.id },
    data:  { status: 'REVOKED' }
  });
  res.json({ ok: true });
});

// ── Public: validate an invite token (used by signup page) ────────────────────
router.get('/validate/:token', async (req, res) => {
  const invite = await prisma.adminInvite.findUnique({ where: { token: req.params.token } });
  if (!invite)                               return res.status(404).json({ valid: false, error: 'Invite not found' });
  if (invite.status === 'ACCEPTED')          return res.status(410).json({ valid: false, error: 'Invite already used' });
  if (invite.status === 'REVOKED')           return res.status(410).json({ valid: false, error: 'Invite was revoked' });
  if (new Date() > invite.expiresAt)         return res.status(410).json({ valid: false, error: 'Invite expired' });
  res.json({ valid: true, email: invite.email });
});

export default router;
