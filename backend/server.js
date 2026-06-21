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
import tournamentRoutes from './routes/tournament.js';
import { startCronJobs } from './lib/cron.js';

const app = express();

// CORS: allow FRONTEND_URL list, plus Railway and Cloudflare Pages subdomains
const allowedOrigins = (process.env.FRONTEND_URL || 'http://localhost:5173')
  .split(',').map(s => s.trim());
app.use(cors({
  origin: (origin, cb) => {
    if (!origin) return cb(null, true);                       // mobile apps, curl
    if (allowedOrigins.includes(origin)) return cb(null, true);
    let host = '';
    try { host = new URL(origin).hostname; } catch { return cb(null, false); }
    if (/\.railway\.app$/.test(host))   return cb(null, true);
    if (/\.pages\.dev$/.test(host))     return cb(null, true);  // Cloudflare Pages
    if (/\.workers\.dev$/.test(host))   return cb(null, true);
    if (/^localhost(:\d+)?$/.test(host)) return cb(null, true);
    // Don't throw — just disallow, so preflight gets a clean response
    return cb(null, false);
  },
  credentials: true
}));
app.options('*', cors());  // ensure preflight OPTIONS are handled
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
app.use('/api/tournament', tournamentRoutes);

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
