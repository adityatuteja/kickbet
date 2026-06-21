// routes/paymentMethods.js
import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { requireAuth, requireAdmin } from '../middleware/auth.js';

const router = Router();
const prisma = new PrismaClient();

// Any authenticated user can read active payment methods
router.get('/', requireAuth, async (req, res) => {
  const methods = await prisma.paymentMethod.findMany({
    where:   { isActive: true },
    orderBy: { createdAt: 'asc' }
  });
  res.json(methods);
});

// Admin can see all (including inactive)
router.get('/all', requireAdmin, async (req, res) => {
  const methods = await prisma.paymentMethod.findMany({ orderBy: { createdAt: 'asc' } });
  res.json(methods);
});

// Admin creates a new method
router.post('/', requireAdmin, async (req, res) => {
  const { type, label, upiId, qrCodeUrl, bankName, accountName, accountNo, ifsc, branch, cashAddress, cashContact, notes } = req.body;

  if (!type || !label) return res.status(400).json({ error: 'type and label are required' });
  if (type !== 'CASH')
    return res.status(400).json({ error: 'Only the in-person option is supported' });

  // Validate based on type
  if (type === 'UPI'  && !upiId)        return res.status(400).json({ error: 'UPI handle required' });
  if (type === 'QR'   && !qrCodeUrl)    return res.status(400).json({ error: 'QR code image URL required' });
  if (type === 'BANK' && (!accountNo || !ifsc || !accountName))
    return res.status(400).json({ error: 'Account name, number and IFSC are required for bank' });
  if (type === 'CASH' && !cashAddress)  return res.status(400).json({ error: 'A meeting place is required' });

  const m = await prisma.paymentMethod.create({
    data: { type, label, upiId, qrCodeUrl, bankName, accountName, accountNo, ifsc, branch, cashAddress, cashContact, notes }
  });
  res.json(m);
});

// Admin updates a method
router.patch('/:id', requireAdmin, async (req, res) => {
  const { type, ...rest } = req.body; // type usually shouldn't change
  const m = await prisma.paymentMethod.update({ where: { id: req.params.id }, data: rest });
  res.json(m);
});

// Admin toggles active status
router.patch('/:id/toggle', requireAdmin, async (req, res) => {
  const existing = await prisma.paymentMethod.findUnique({ where: { id: req.params.id } });
  if (!existing) return res.status(404).json({ error: 'Not found' });
  const m = await prisma.paymentMethod.update({
    where: { id: req.params.id },
    data:  { isActive: !existing.isActive }
  });
  res.json(m);
});

// Admin deletes a method
router.delete('/:id', requireAdmin, async (req, res) => {
  await prisma.paymentMethod.delete({ where: { id: req.params.id } });
  res.json({ ok: true });
});

export default router;
