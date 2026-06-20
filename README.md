# ⚽ KickBet — FIFA Match Pool Betting

A pool-based (parimutuel) betting platform for FIFA matches, with a Girls Education fund. Players commit to a shared pool, bet on match questions with live-moving odds, and winners split each pool. A percentage of winnings goes to charity.

**Live:** frontend on Cloudflare Pages · backend + Postgres on Railway (Singapore).

---

## How it works (the rules)

### Money & the pool
- Join by committing to a shared pool — **minimum ₹10,000** first time; top-ups only increase.
- Pay the admin via UPI/Paytm, QR, bank transfer (IFSC), or cash.
- Admin **acknowledges receipt** (Received / Partial / Not Received). Only confirmed money becomes your betting balance.
- Balance = **committed** (locked in bets) + **available** (what you can still bet).
- Transfers are **admin-only** — players can't send money to each other.

### Betting — parimutuel
- **No fixed odds.** Each question is its own pool; the multiplier = total pool ÷ money on that option.
- Odds **move live** as people bet, and **lock when betting closes** (30 min before kickoff).
- Winners split the **entire pool** in proportion to their stake — every rupee is used.
- If nobody is correct, the pot **rolls over** into the next match.

### Girls Education fund
- Each bet donates a chosen % (0–100, default 5%) of **winnings** to the fund — never your stake.

### Admins
- The **root admin** (first account) is the only one who can invite other admins.
- Admins join by **one-time, email-locked invitation** (7-day expiry). No self- or peer-promotion.

---

## Tech stack
- **Backend:** Node + Express + Prisma + PostgreSQL
- **Frontend:** React + Vite
- **Deploy:** Railway (backend + DB, Singapore region) + Cloudflare Pages (frontend CDN)

## Run locally (Docker)
```bash
docker compose up --build
```
Frontend → http://localhost:5173 · API → http://localhost:3001

Demo accounts: `admin/admin123` (root admin), `alice/pass123`, `bob/pass123`.

## Deploy
See [DEPLOY.md](./DEPLOY.md) for the full Railway + Cloudflare walkthrough.
