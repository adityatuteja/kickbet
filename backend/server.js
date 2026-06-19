// server.js
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import authRoutes    from './routes/auth.js';
import matchRoutes   from './routes/matches.js';
import betRoutes     from './routes/bets.js';
import userRoutes    from './routes/users.js';
import adminRoutes   from './routes/admin.js';
import donationRoutes from './routes/donations.js';
import poolRoutes    from './routes/pool.js';
import paymentRoutes from './routes/paymentMethods.js';
import inviteRoutes  from './routes/invites.js';
import { startCronJobs } from './lib/cron.js';

const app = express();

// CORS: allow comma-separated FRONTEND_URL list, or any railway.app subdomain by default
const allowedOrigins = (process.env.FRONTEND_URL || 'http://localhost:5173')
  .split(',').map(s => s.trim());
app.use(cors({
  origin: (origin, cb) => {
    if (!origin) return cb(null, true);                       // mobile apps, curl
    if (allowedOrigins.includes(origin)) return cb(null, true);
    if (/\.railway\.app$/.test(new URL(origin).hostname)) return cb(null, true);
    if (/\.up\.railway\.app$/.test(new URL(origin).hostname)) return cb(null, true);
    cb(new Error('CORS blocked: ' + origin));
  },
  credentials: true
}));
app.use(express.json());

app.use('/api/auth',      authRoutes);
app.use('/api/matches',   matchRoutes);
app.use('/api/bets',      betRoutes);
app.use('/api/users',     userRoutes);
app.use('/api/admin',     adminRoutes);
app.use('/api/donations', donationRoutes);
app.use('/api/pool',     poolRoutes);
app.use('/api/payment-methods', paymentRoutes);
app.use('/api/invites',  inviteRoutes);

app.get('/api/health', (_, res) => res.json({ ok: true, ts: new Date() }));

startCronJobs();

const PORT = process.env.PORT || 3001;
// Catch-all Express error handler — converts thrown errors into 500s instead of crashing
app.use((err, req, res, next) => {
  console.error('Unhandled route error:', err);
  if (res.headersSent) return next(err);
  res.status(500).json({ error: err?.message || 'Internal server error' });
});

// Last-resort safety nets so one bad async path can't kill the whole server
process.on('unhandledRejection', (reason) => {
  console.error('Unhandled promise rejection:', reason);
});
process.on('uncaughtException', (err) => {
  console.error('Uncaught exception:', err);
});

app.listen(PORT, '0.0.0.0', () => console.log(`KickBet API running on :${PORT}`));
