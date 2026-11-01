# NutriLens — see what your food does to you

NutriLens is a full-stack app for people who read nutrition labels but don't know what the numbers mean over time.
Scan (paste / type / quick-fill) any packaged food's nutrition table, and it tells you:

1. **What happens in your body** — sugar spikes, insulin resistance, blood-pressure creep, LDL and plaque,
   fatty liver, additive and ultra-processing exposure — with a timeframe and the evidence behind it.
2. **How much is safe in a day** — a gram-and-serving allowance derived from the nutrient that binds first
   (WHO / ICMR-NIN daily caps), plus how often to eat it.
3. **What to eat instead** — healthier swaps scored on the same engine, with the actual deltas (−72% sugar, −92% sodium…).
4. **Personalised risk** — the score is re-weighted against your conditions (diabetes, obesity, hypertension,
   high cholesterol, fatty liver, PCOS, kidney, cancer risk, IBS/gut, gout).

> Educational tool. Not a diagnosis. Caps come from WHO free-sugars/sodium guidance, ICMR-NIN Dietary
> Guidelines for Indians (2024), NOVA classification, UK FSA front-of-pack profiling and a 2024 BMJ umbrella
> review of ultra-processed foods.

---

## Run it

**Easiest — one click:** double-click `run.bat` (Windows) or `./run.sh` (macOS/Linux).
It checks Node, installs what's missing, builds if needed and starts the server.

**Or by hand** (needs Node.js 18+; 20, 22 or 24 all work):

```bash
cd nutrilens
npm install          # server deps (express, better-sqlite3, bcryptjs, jsonwebtoken)
npm start            # http://localhost:4000   (client/dist is pre-built)
```

Only if you change front-end code: `npm run build` (installs client deps + rebuilds),
or `npm run dev` for hot reload (Vite on :5173 proxying the API on :4000; run
`npm --prefix client install` once first).

Change the port with `PORT=8080 npm start` (Windows: `set PORT=8080 && npm start`).

### Something not working? Run the health check

```bash
npm run doctor
```

It reports your Node version, whether dependencies are installed, which SQLite driver is in use, whether the
client is built, whether the data folder is writable, and whether port 4000 is free — with the command to fix
each problem.

**"localhost refused to connect"?** The server process isn't running. `npm start` keeps running in the
foreground, so leave that window open; the browser only works once the console prints
`NutriLens listening on http://0.0.0.0:4000`. If the terminal shows `EADDRINUSE`, something else owns the port:
`set PORT=4001 && npm start` (Windows) or `PORT=4001 npm start` (macOS/Linux).

### Node 22.5+ needs no compiler

SQLite is reached through a small shim (`server/sqlite.js`): it uses the built-in **`node:sqlite`** module
(Node 22.5+, always available, nothing to compile) and only falls back to the optional native
`better-sqlite3` package when that is present. That means `npm install` never needs Visual Studio / Xcode —
which is what used to fail on Windows with:

```
gyp ERR! find VS You need to install the latest version of Visual Studio
```

If you hit that error with an older copy, delete `node_modules` and `package-lock.json`, then re-run
`npm install`. On Node 22.5+ you can also skip the native module entirely:

```bash
npm install --omit=optional   # no native build at all, uses node:sqlite
npm start
```

The one-line `ExperimentalWarning: SQLite is an experimental feature` on Node 22/24 is harmless — it is
Node announcing its own built-in module.

`GET /api/health` reports which driver is active (`"driver": "node:sqlite"` or `"better-sqlite3"`).

The server serves the built SPA **and** the API on one port, and seeds the database on first boot.

**Demo logins** (1 tap on the login screen for the first one):

| Account | Password | Role | Email confirmed | What it shows |
| --- | --- | --- | --- | --- |
| `demo@nutrilens.app` | `demo1234` | **admin** | yes | 7-item pantry, 16 scans across 14 days, 20 logged meals, `/admin` |
| `meera@nutrilens.app` | `demo1234` | member | no | the “confirm your email” banner and a fresh, empty account |

New accounts start empty so you can see every empty state.

### Other scripts

| Command | What it does |
| --- | --- |
| `npm start` | Production server (API + built client) on `:4000` |
| `npm run dev` | API on `:4000` + Vite dev server on `:5173` (proxies `/api`) |
| `npm run build` | Build the React client |
| `npm run seed` | Wipe and re-seed the demo dataset |
| `npm run doctor` | Diagnose Node, dependencies, SQLite driver, build output and the port |

## Stack

- **Backend** — Node 20+ · Express 4 · SQLite (WAL) via `node:sqlite` or `better-sqlite3` · JWT auth · bcrypt.
- **Frontend** — React 18 · TypeScript · Vite · Tailwind · Recharts · lucide-react.
- **Storage** — `data/nutrilens.db` (SQLite, persists across restarts).

```
server/
  index.js        Express app, static SPA, error handling
  db.js           Schema, migrations + row mappers
  sqlite.js       Driver shim: node:sqlite (built in) or better-sqlite3 (optional)
  auth.js         JWT, requireAuth / requireAdmin
  mailer.js       Mail transport, single-use tokens, dev outbox
  analysis.js     The scoring engine, consequence generator, daily-allowance maths
  additives.js    Additive knowledge base + ingredient-text matcher
  alternatives.js Swap ranking (category + problem-tag relevance)
  parse-label.js  "Smart paste" nutrition-table parser
  seed.js/.data   Catalogue, 20 swaps, demo user, history
  routes/         auth · admin · products · catalogue · scans · logs · dashboard · library
client/src/
  pages/          Login · Dashboard · Scan · Pantry · DailyLog · Learn · Profile · Admin
                  VerifyEmail · ForgotPassword · ResetPassword · OAuthCallback
  components/     Layout/sidebar, UI kit, ScoreRing, charts, CameraScan, DevMailbox, AuthShell
  context/        Auth, toasts
  lib/            API client, types, formatting/tone helpers, ocr.ts (Tesseract worker)
client/public/tesseract/   on-device OCR runtime (worker, 2 core loaders, eng model)
data/nutrilens.db          SQLite database (created + seeded on first boot)
```

## What's implemented

- **Auth** — register (with condition picker), login, JWT sessions, profile + password update, route guards.
- **Email verification & password reset** — single-use, hashed, expiring tokens; the same generic answer
  whether or not an account exists; resetting also confirms the address. No SMTP account is bundled, so
  messages land in a **dev mailbox** (in-app panel + server console). See *Email, reset links and OAuth*.
- **OAuth sign-in** — real Google code flow when `GOOGLE_CLIENT_ID`/`_SECRET` are set, otherwise a clearly
  labelled demo sign-in that creates a normal OAuth-linked account.
- **Roles & admin** — `user` / `admin`; `/admin` (server-guarded) shows accounts with their stored data,
  promotes/demotes, confirms emails by hand, deletes accounts, and charts workspace activity.
- **Camera label scanning** — photo or upload → on-device OCR (Tesseract WASM, nothing is uploaded) →
  editable review with a confidence score → parsed straight into the form.
- **Scoring engine** — 8 weighted components (sugar, sodium, sat fat, trans fat, calorie density, fibre,
  additives, NOVA class), condition multipliers, hard floors for trans fat/high sugar/high sodium,
  verdict bands 0–100, per-serving sugar teaspoons, yearly sugar/sodium/weight-gain estimates.
- **Label tooling** — smart paste parser (handles "per 100 g" and "per serving", kJ→kcal, salt→sodium),
  ingredient-list additive detection (INS codes, hydrogenated fat, HFCS, palm oil, maltodextrin…),
  27-product catalogue for one-click quick fill.
- **CRUD** — Pantry products (create / read / update / delete + import from catalogue), intake logs
  (create / update / delete per meal), scans (create / re-analyse at a new portion / note / delete),
  health profile. All list/delete actions are **optimistic** with rollback + toast on failure.
- **Dashboard** — risk trend (14 days), verdict mix donut, today's budget bars, 7-day sugar chart,
  suggested swap card, recent scans, offender watch list.
- **Daily log** — date navigation, per-meal sections, editable portions, daily caps + 7-day chart.
- **Learn** — searchable additive decoder, swap library by category, how-the-score-works, condition guides.
- **UX** — skeleton loading states everywhere, friendly empty states, toasts with undo-style actions,
  responsive sidebar/drawer, mobile-first layouts, accessible modals (ESC/backdrop close, scroll lock).

## Daily reference caps used

| Nutrient | Cap |
| --- | --- |
| Free sugars | 50 g (ideal < 25 g) |
| Sodium | 2,000 mg |
| Saturated fat | 20 g |
| Industrial trans fat | < 1 g |
| Fibre | 30 g (minimum) |
| Single-snack energy | 500 kcal |

## Deploying

`DEPLOY.md` has the full guide (Render, Railway, Fly.io, or your own VPS with nginx + systemd), the environment
variables that matter, and a post-deploy checklist. The short version: this is **one Node process** serving the
API and the built SPA, with a **SQLite file** for storage — so it needs a host with a persistent disk
(Render Starter, Railway volume, Fly.io volume, or a VPS). Vercel/Netlify alone won't work.

Two safety switches exist for public deployments:

| Variable | Effect |
| --- | --- |
| `SEED_DEMO=off` | Skips the demo accounts; the **first account you register becomes admin** |
| `DEV_MAILBOX` | Unset in production = the in-app mailbox is disabled (it would otherwise expose reset links). `on` = kept but **admin-only** |

Also set `JWT_SECRET` and `PUBLIC_URL`, and remember camera scanning needs HTTPS.

## Email, reset links and OAuth

There is no mail server in this build, so every outgoing message is captured instead of delivered:

- it is printed to the server console (`📮 [mail] …`), and
- it is stored in `dev_outbox` and shown in the **Dev mailbox** panel — on the sign-in screen, on
  *Forgot password*, and under your health profile. Each entry has an *Open the link* button.

The links themselves are real: 32-byte random tokens, stored only as SHA-256 hashes, single-use, expiring
(24 h for confirmations, 1 h for resets). Confirmation links never reveal whether an email is registered, and
resetting a password also marks the address confirmed, because it proves control of the inbox.

| Env var | Effect |
| --- | --- |
| `PUBLIC_URL` | Base URL used in email links (default `http://localhost:PORT`) |
| `MAIL_WEBHOOK_URL` | POST `{ to, subject, text, html }` here as well — point it at Resend/Zapier/Lambda to send for real |
| `DEV_MAILBOX=off` | Hide and disable the in-app mailbox (`/api/auth/dev-mailbox` returns 404, outbox is cleared) |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Enable the real Google OAuth flow; the redirect URI is `PUBLIC_URL/api/auth/oauth/google/callback` |

Without Google credentials the "Continue with Google" button runs a **demo sign-in** (`/api/auth/oauth/demo`)
that creates/signs in `riya.sharma@google.demo.nutrilens.app` with `provider = google` — so verification state,
roles and the admin screen behave exactly as they would for a real OAuth user.

### Admin surface

`/admin` is only in the sidebar for admins, and the API enforces it (`403` for everyone else, whatever the
URL). Safety rails: you cannot demote or delete the account you are signed in with, and the workspace always
keeps at least one admin. Deleting an account cascades to that user's pantry, scans and food logs; the shared
catalogue is untouched.

## Camera scanning

`Scan → Scan with camera` (also on the empty state and mobile). The photo is read **on the device** with
Tesseract.js — the image never leaves the browser, and the runtime (worker, WASM cores, English model) is
bundled under `client/public/tesseract/`, so nothing is fetched from a CDN. The first scan downloads ~6 MB of
model from the same server and is then cached by the browser; later scans are instant.

Captured text is cleaned up (decimal commas, full-width digits, the classic `g`→`9` and `l`→`1` confusions),
shown in an editable box with a confidence score, then merged into the form through the same
`POST /api/parse-label` parser that "Smart paste" uses. No camera (or permission denied)? The same dialog
accepts a file upload or drag-and-drop instead.
