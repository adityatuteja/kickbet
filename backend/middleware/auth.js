// middleware/auth.js
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const SECRET = process.env.JWT_SECRET || 'kickbet-secret';

export function requireAuth(req, res, next) {
  const header = req.headers.authorization;
  if (!header) return res.status(401).json({ error: 'No token' });
  const token = header.split(' ')[1];
  try {
    req.user = jwt.verify(token, SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
}

export function requireAdmin(req, res, next) {
  requireAuth(req, res, () => {
    if (!req.user.isAdmin) return res.status(403).json({ error: 'Admin only' });
    next();
  });
}

// Verifies the caller is the root admin (checks DB, since JWT may be stale)
export function requireRootAdmin(req, res, next) {
  requireAuth(req, res, async () => {
    const u = await prisma.user.findUnique({ where: { id: req.user.id } });
    if (!u || !u.isRootAdmin)
      return res.status(403).json({ error: 'Only the root admin can perform this action' });
    next();
  });
}
