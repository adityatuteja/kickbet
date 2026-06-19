# Deploying KickBet to the Internet (India + US + Canada)

## Architecture — best performance for an India-primary, globally-distributed audience

```
                    ┌─────────────────────────────────────┐
   India users  ───▶│  Cloudflare Pages (frontend)        │
   US users     ───▶│  300+ edge locations worldwide      │── static app loads
   Canada users ───▶│  FREE · global CDN                  │   locally everywhere
                    └──────────────┬──────────────────────┘
                                   │ API calls (JSON only)
                                   ▼
                    ┌─────────────────────────────────────┐
                    │  Railway — Singapore region         │
                    │  ┌─────────────┐  ┌───────────────┐ │
                    │  │ Backend API │──│ Postgres (HA) │ │
                    │  └─────────────┘  └───────────────┘ │
                    │  ~40-60ms to India · ~$5/mo         │
                    └─────────────────────────────────────┘
```

**Why this layout:**
- The React app (HTML/CSS/JS) is served from Cloudflare's edge — so it loads instantly in Mumbai, New York, and Toronto alike.
- Only the lightweight JSON API calls travel to Singapore, which is the closest Railway region to India (your largest user base).
- US and Canada reach Singapore in ~220-250ms for API calls — acceptable for a betting app where actions are deliberate (not a real-time game). Their app shell is still edge-fast via Cloudflare.
- No expensive multi-region database replication needed.

---

## Part A — Deploy the backend + database to Railway (Singapore)

### 1. Push to GitHub
```bash
cd ~/fifa/kickbet
git init && git add -A && git commit -m "KickBet"
# create a repo on github.com, then:
git remote add origin https://github.com/YOUR_USERNAME/kickbet.git
git branch -M main && git push -u origin main
```

### 2. Create the Railway project + Postgres
1. Go to https://railway.com/new → **Empty Project**
2. **+ New** → **Database** → **PostgreSQL**
3. Click the Postgres service → **Settings** → set **Region = Southeast Asia (Singapore)**

### 3. Deploy the backend
1. **+ New** → **GitHub Repo** → select your repo → **Cancel** the first build
2. Click the service → **Settings**:
   - **Root Directory**: `backend`
   - **Region**: **Southeast Asia (Singapore)** — same as the DB
   - **Networking** → **Generate Domain** → copy the URL (e.g. `kickbet-api.up.railway.app`)
3. **Variables** tab:
   - **+ Add Reference** → `DATABASE_URL` → point to the Postgres service's `DATABASE_URL`
   - Add plain variables:
     ```
     JWT_SECRET=<paste a long random string>
     FRONTEND_URL=https://kickbet.pages.dev
     ```
     (update `FRONTEND_URL` after Part B once you know the real Cloudflare URL)
   - Optional email:
     ```
     SMTP_HOST=smtp.gmail.com
     SMTP_PORT=587
     SMTP_USER=you@gmail.com
     SMTP_PASS=<gmail app password>
     ```
4. **Deploy**. Check `https://<backend-url>/api/health` → should return `{ ok: true }`.

---

## Part B — Deploy the frontend to Cloudflare Pages (global CDN)

### 1. Connect the repo
1. Go to https://dash.cloudflare.com → **Workers & Pages** → **Create** → **Pages** → **Connect to Git**
2. Select your `kickbet` repo

### 2. Build settings
| Field | Value |
|---|---|
| Production branch | `main` |
| Framework preset | `Vite` |
| Build command | `npm run build` |
| Build output directory | `dist` |
| Root directory | `frontend` |

### 3. Environment variable
Add under **Settings → Environment variables**:
```
VITE_API_URL = https://<your-backend-url-from-Part-A>
```
(No `/api` suffix — the app adds it.)

### 4. Deploy
Click **Save and Deploy**. You'll get a URL like `https://kickbet.pages.dev`.

### 5. Link them together
Go back to Railway → backend → **Variables** → set `FRONTEND_URL` to your Cloudflare URL → redeploy.

---

## Part C — Open the app

Visit your Cloudflare URL. Sign in:

| Username | Password | Role |
|---|---|---|
| admin | admin123 | Admin |
| alice | pass123 | User |
| bob | pass123 | User |

**Change the admin password immediately** in production.

---

## Custom domain (optional but recommended)

In Cloudflare Pages → **Custom domains** → add e.g. `kickbet.com`. If your domain is already on Cloudflare DNS, this is one click and gives you automatic HTTPS. Point a subdomain like `api.kickbet.com` at the Railway backend via a CNAME for a clean setup.

---

## Costs

| Service | Cost |
|---|---|
| Cloudflare Pages (frontend) | **Free** (unlimited bandwidth, 500 builds/mo) |
| Railway backend + Postgres | **~$5/mo** (Hobby plan, includes $5 credits) |
| **Total** | **~$5/mo** |

---

## Performance expectations

| User location | App shell load | API call round-trip |
|---|---|---|
| 🇮🇳 India | edge-fast (~20ms) | ~40-60ms |
| 🇺🇸 US | edge-fast (~20ms) | ~220ms |
| 🇨🇦 Canada | edge-fast (~20ms) | ~240ms |

For a pool betting app (deliberate actions, not twitch gameplay), this is excellent everywhere.

---

## If you'd rather keep everything on Railway (simpler, one vendor)

You can also deploy the frontend as a 3rd Railway service (Root Directory `frontend`, it has its own Dockerfile + `railway.json`). Set its `VITE_API_URL` variable to the backend URL. You lose the global CDN edge for the app shell, so US/Canada users wait the full ~220ms even for the initial page load — but it's one less account to manage. The Cloudflare route is strictly better for performance; pick based on whether you value simplicity over the edge speedup.

---

## Auto-deploys

After setup, every `git push` to `main` redeploys the changed services automatically — both Railway and Cloudflare watch your repo.
