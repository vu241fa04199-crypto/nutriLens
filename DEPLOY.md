# Deploying NutriLens

NutriLens is one Node process that serves both the API **and** the built React app, with a SQLite file for
storage. That means it needs a host that:

- runs a **long-lived Node process** (not serverless functions), and
- gives you a **persistent disk** (a free 512 MB–1 GB volume is plenty).

Vercel / Netlify / Cloudflare Pages alone will **not** work: the filesystem there is read-only or ephemeral,
and `server/data/nutrilens.db` would vanish on every request.

Good fits, easiest first: **Render**, **Railway**, **Fly.io**, or any **VPS** (Hetzner/DigitalOcean/Lightsail).

---

## What you must set (all platforms)

| Variable | Why | Example |
| --- | --- | --- |
| `NODE_ENV` | Turns on production behaviour (mailbox locked, HSTS) | `production` |
| `JWT_SECRET` | Signs session tokens. Without it a new one is generated per filesystem, so every deploy logs everyone out | long random string |
| `PUBLIC_URL` | Base URL used inside email links | `https://nutrilens.example.com` |
| `DATA_DIR` | Where the SQLite file lives — **must be on the persistent disk** | `/var/data` |
| `SEED_DEMO` | `off` on a public site: no `demo@nutrilens.app / demo1234` account | `off` |
| `PORT` | Usually injected by the platform | `4000` |

Optional:

| Variable | Why |
| --- | --- |
| `MAIL_WEBHOOK_URL` | POSTs `{to, subject, text, html}` to a provider (Resend, Zapier, a Lambda) so verification/reset emails are actually delivered. Without it, messages are only logged and (in dev) shown in the in-app mailbox. |
| `DEV_MAILBOX` | `on` = keep the in-app mailbox; in production it becomes **admin-only**. `off` = disabled. Default in production: off. |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Enable real "Continue with Google". Redirect URI: `PUBLIC_URL/api/auth/oauth/google/callback`. |
| `SEED_DEMO` | `on` (default) seeds the demo user; `off` starts empty and the **first account you register becomes admin**. |

Generate a secret quickly: `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`.

---

## Note: the client is built on the host

`client/dist` is **not** in git (it is in `.gitignore`), so every platform below builds the React app as part of
the deploy: `npm run build` installs the client's devDependencies (vite, TypeScript) and writes `client/dist`,
which Express then serves. That is why `render.yaml` uses
`buildCommand: npm install --no-audit --no-fund && npm run build` and the Dockerfile has a build step.

The build needs a little memory (≈512 MB+) and adds 1–3 minutes to the first deploy. If you edit the UI, just
push — the next deploy rebuilds it.

## Option A — Render (no command line, ~10 minutes)

1. Push this folder to a GitHub repo (private is fine).
   ```bash
   cd nutrilens
   git init && git add . && git commit -m "NutriLens"
   git branch -M main
   git remote add origin https://github.com/<you>/nutrilens.git
   git push -u origin main
   ```
2. In Render: **New + → Blueprint**, pick the repo. `render.yaml` in this folder configures everything —
   web service, Node 22, `/api/health` check, a 1 GB disk at `/var/data`, `SEED_DEMO=off`, generated `JWT_SECRET`.
3. After the first deploy, open the service → **Environment** → set `PUBLIC_URL` to
   `https://<your-service>.onrender.com` (or your custom domain) and let it redeploy.
4. Register an account on the live URL — it becomes the admin. Sign in, open **/admin** to confirm.

Cost note: `render.yaml` defaults to the **free** plan with **no disk**, so the database resets on every
deploy/restart (fine for a demo). To keep data: upgrade the service to **Starter** (~$7/mo), add

```yaml
    disk:
      name: nutrilens-data
      mountPath: /var/data
      sizeGB: 1
```

under the service, plus an env var `DATA_DIR=/var/data`, then push. Free services also sleep after ~15 minutes
of inactivity — the first request afterwards takes ~30–60 s to wake up.

## Option B — Railway

1. **New Project → Deploy from GitHub**, pick the repo.
2. Service → **Variables**: `NODE_ENV=production`, `DATA_DIR=/data`, `SEED_DEMO=off`, `PUBLIC_URL=https://…`,
   and `JWT_SECRET` (or generate one).
3. Service → **Settings → Volumes**: add a volume mounted at **`/data`** (must match `DATA_DIR`).
4. Settings → **Networking → Generate domain**, then set `PUBLIC_URL` to it and redeploy.

## Option C — Fly.io (Dockerfile included)

```bash
fly launch --no-deploy          # accept the Dockerfile, pick a region close to you (e.g. bom = Mumbai)
fly volumes create nutrilens_data --size 1
# in fly.toml, make sure you have:  [mounts] source = "nutrilens_data"  destination = "/data"
fly secrets set NODE_ENV=production DATA_DIR=/data SEED_DEMO=off \
                PUBLIC_URL=https://<your-app>.fly.dev \
                JWT_SECRET=$(node -e "console.log(require('crypto').randomBytes(48).toString('hex'))")
fly deploy
```

## Option D — your own VPS (full control)

```bash
# on the server (Ubuntu 22/24), as a normal user with sudo
sudo apt update && sudo apt install -y nginx
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash - && sudo apt install -y nodejs
git clone <your repo> /opt/nutrilens && cd /opt/nutrilens
npm install --omit=dev --no-audit --no-fund
sudo mkdir -p /var/lib/nutrilens && sudo chown $USER /var/lib/nutrilens

# run it as a service
sudo tee /etc/systemd/system/nutrilens.service >/dev/null <<'UNIT'
[Unit]
Description=NutriLens
After=network.target

[Service]
WorkingDirectory=/opt/nutrilens
ExecStart=/usr/bin/node server/index.js
Restart=always
Environment=NODE_ENV=production
Environment=PORT=4000
Environment=DATA_DIR=/var/lib/nutrilens
Environment=SEED_DEMO=off
Environment=PUBLIC_URL=https://your-domain.com
Environment=JWT_SECRET=replace-me
User=%i

[Install]
WantedBy=multi-user.target
UNIT
sudo sed -i "s/User=%i/User=$USER/" /etc/systemd/system/nutrilens.service
sudo systemctl enable --now nutrilens
```

Then put nginx + HTTPS in front:

```nginx
server {
    server_name your-domain.com;
    location / {
        proxy_pass http://127.0.0.1:4000;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```
```bash
sudo certbot --nginx -d your-domain.com     # free TLS
```

---

## After it's live — checklist

- [ ] `https://your-domain/api/health` returns `{"ok":true,…}` and the `driver` you expect.
- [ ] Register the first account → it is an admin → **/admin** loads.
- [ ] `SEED_DEMO=off` (or the demo password changed) so nobody logs in as `demo@nutrilens.app`.
- [ ] `JWT_SECRET` set (otherwise a redeploy logs everyone out).
- [ ] `PUBLIC_URL` matches the real URL — open *Forgot password* and check the reset link points at your domain.
- [ ] Decide on email: either set `MAIL_WEBHOOK_URL`, or leave `DEV_MAILBOX` off and accept that password reset
      is unavailable (users can still change the password from their profile).
- [ ] Camera scanning works — it needs **HTTPS** (browsers block `getUserMedia` on plain HTTP, except localhost).
- [ ] Backups: see below.

## Backups (SQLite)

The whole database is one file (plus `-wal`/`-shm` while running). Copy it on a schedule:

```bash
# safe hot copy (works while the app is running)
sqlite3 /var/lib/nutrilens/nutrilens.db ".backup '/backups/nutrilens-$(date +%F).db'"
```
On Render/Railway, download the disk snapshot instead — or hit the file through a tiny admin box.
Keep the last 7–14 copies somewhere off the server.

## Scaling notes

- One process is fine for a personal/small-team deployment (SQLite handles this easily).
- If you need more than one instance, move the database to Postgres — everything SQL lives in
  `server/*.js` + `server/routes/*.js` behind `db.prepare(...)`, so the change is contained.
- The built client in `client/dist` is served by Express with a 1-hour cache. If you edit the UI, run
  `npm run build` in the repo and redeploy.
