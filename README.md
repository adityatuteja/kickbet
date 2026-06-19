# ⚽ KickBet — FIFA Match Betting App

Full-stack betting platform for FIFA matches with Girls Education fund integration.

## Features

- **Auth** — Register with username, alias (shown to others), email, password. JWT sessions stored in localStorage.
- **Matches** — Questions open 12h before kickoff, locked 30 min before. Cron auto-manages status.
- **Betting** — Each option has a stake price + multiplier. Win = stake × multiplier. Balance enforced in real-time; can't exceed available funds.
- **Balance tracking** — `balance`, `committed` (in active bets), `available = balance - committed`.
- **Girls Education** — 5% of every bet auto-contributed. Separate `/girls-edu` page shows per-user breakdown with bar charts, doughnut, and timeline.
- **Sidebar banner** — Persistent on every page.
- **Email notifications** — Sent 12h before betting opens (via nodemailer/SMTP).
- **Admin panel** — Create matches, set questions + prices, manage admin users, change match status.
- **Aliases** — Public leaderboard shows only aliases; real names/emails never exposed to other users.
- **Mobile** — Responsive layout with bottom tab nav on mobile.

---

## Quick Start (Local)

### Prerequisites
- Node 20+
- PostgreSQL 15+ (or Docker)

### 1. Clone & install

```bash
# Backend
cd backend
cp .env.example .env        # fill in DATABASE_URL, JWT_SECRET, SMTP_*
npm install
npx prisma db push
node prisma/seed.js          # creates admin/alice/bob + sample match

# Frontend
cd ../frontend
npm install
```

### 2. Run

```bash
# Terminal 1 — backend
cd backend && npm run dev

# Terminal 2 — frontend
cd frontend && npm run dev
```

Open http://localhost:5173

**Demo accounts:**
| Username | Password | Role |
|----------|----------|------|
| admin    | admin123 | Admin |
| alice    | pass123  | User |
| bob      | pass123  | User |

---

## Docker (easiest)

```bash
cp backend/.env.example .env   # set SMTP_USER and SMTP_PASS
docker compose up --build
```

Frontend → http://localhost:5173  
API → http://localhost:3001

---

## Cloud Deployment

### Cheapest options by region

| Region  | Provider     | Service          | Cost/mo   | Notes |
|---------|-------------|-----------------|-----------|-------|
| 🇮🇳 India  | Railway      | Mumbai region    | ~$5–10    | Postgres included |
| 🇮🇳 India  | Render       | ap-south-1       | Free tier | Sleeps after 15m idle |
| 🇺🇸 US     | Fly.io       | ord/iad          | Free tier | 3 shared CPUs free |
| 🇺🇸 US     | Railway      | us-west          | ~$5       | Best DX |
| 🇨🇦 Canada | Fly.io       | yyz (Toronto)    | Free tier | Add `fly.toml` |
| 🇨🇦 Canada | Railway      | ca-central       | ~$5       | |

### Railway (recommended — India + US + Canada)

```bash
# Install Railway CLI
npm install -g @railway/cli
railway login

# Deploy backend
cd backend
railway init
railway add postgresql        # provisions DB, sets DATABASE_URL automatically
railway variables set JWT_SECRET=your-secret FRONTEND_URL=https://your-frontend.up.railway.app
railway up

# Deploy frontend
cd ../frontend
# Set VITE_API_URL in frontend if not using same domain
railway init
railway up
```

Select region during `railway init` → choose Mumbai (India), US West, or Canada.

### Fly.io (Toronto/Canada)

```bash
cd backend
fly launch --region yyz      # Toronto
fly postgres create           # attach Postgres
fly secrets set JWT_SECRET=your-secret
fly deploy
```

---

## Environment Variables

### Backend (`backend/.env`)

| Variable       | Description |
|----------------|-------------|
| `DATABASE_URL` | PostgreSQL connection string |
| `JWT_SECRET`   | Long random string for JWT signing |
| `PORT`         | API port (default 3001) |
| `FRONTEND_URL` | For CORS and email links |
| `SMTP_HOST`    | SMTP server (e.g. smtp.gmail.com) |
| `SMTP_PORT`    | 587 for TLS |
| `SMTP_USER`    | SMTP username/email |
| `SMTP_PASS`    | SMTP password or App Password |

### Frontend (`frontend/.env`)

```
VITE_API_URL=https://your-backend.up.railway.app
```
Update `src/lib/api.js` BASE to use `import.meta.env.VITE_API_URL` for production.

---

## Architecture

```
kickbet/
├── backend/
│   ├── server.js           # Express entry point
│   ├── prisma/
│   │   ├── schema.prisma   # DB schema (User, Match, Question, Option, Bet, BetPick, Donation)
│   │   └── seed.js         # Demo data
│   ├── routes/
│   │   ├── auth.js         # /api/auth (register, login, me)
│   │   ├── matches.js      # /api/matches (list, detail, stats)
│   │   ├── bets.js         # /api/bets (place, my bets)
│   │   ├── users.js        # /api/users (leaderboard, girls-edu)
│   │   ├── admin.js        # /api/admin (matches, questions, admins)
│   │   └── donations.js    # /api/donations (direct donate)
│   ├── middleware/auth.js  # JWT middleware
│   └── lib/
│       ├── mailer.js       # nodemailer email sender
│       └── cron.js         # auto open/close betting windows + email alerts
│
└── frontend/
    └── src/
        ├── pages/
        │   ├── AuthPage.jsx
        │   ├── MatchesPage.jsx    # betting interface
        │   ├── MyBetsPage.jsx
        │   ├── UsersPage.jsx      # player balances
        │   ├── GirlsEduPage.jsx   # fund breakdown with charts
        │   └── AdminPage.jsx      # admin controls
        ├── components/
        │   ├── Sidebar.jsx        # donation banner
        │   └── BetStats.jsx       # pie/bar charts per match
        ├── lib/
        │   ├── api.js             # all API calls
        │   └── AuthContext.jsx    # auth state
        └── hooks/useToast.js
```

---

## Betting Mechanics

1. Admin creates a match and sets questions (up to 10 per match).
2. Each option has a **price** (stake cost) and **multiplier**.
3. User selects options — total stake is deducted from available balance.
4. If the outcome is correct → user keeps their stake and receives `stake × multiplier`.
5. **Balance check**: `available = balance − committed`. Users cannot commit more than their available balance.
6. **5% girls education**: automatically applied to every bet placed; also available as a direct donation.
