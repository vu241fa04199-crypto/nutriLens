import express from 'express';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { seedIfEmpty, isSeeded } from './seed.js';
import { db, dbDriver } from './db.js';

import authRoutes from './routes/auth.js';
import productRoutes, { catalogueRouter } from './routes/products.js';
import scanRoutes from './routes/scans.js';
import logRoutes from './routes/logs.js';
import dashboardRoutes from './routes/dashboard.js';
import libraryRoutes from './routes/library.js';
import adminRoutes from './routes/admin.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = Number(process.env.PORT) || 4000;

app.disable('x-powered-by');
app.set('trust proxy', 1); // correct client IPs behind Render/Railway/Fly/nginx
app.use(express.json({ limit: '1mb' }));

// a few headers that matter once this is on the internet
app.use((req, res, next) => {
  res.set('X-Content-Type-Options', 'nosniff');
  res.set('X-Frame-Options', 'SAMEORIGIN');
  res.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.set('Permissions-Policy', 'camera=(self), microphone=(), geolocation=()');
  if (process.env.NODE_ENV === 'production') {
    res.set('Strict-Transport-Security', 'max-age=15552000; includeSubDomains');
  }
  next();
});

// --- API -------------------------------------------------------------------
app.use('/api', (req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
});

app.get('/api/health', (req, res) => {
  const counts = {
    users: db.prepare('SELECT COUNT(*) c FROM users').get().c,
    products: db.prepare('SELECT COUNT(*) c FROM products').get().c,
    scans: db.prepare('SELECT COUNT(*) c FROM scans').get().c,
    logs: db.prepare('SELECT COUNT(*) c FROM intake_logs').get().c,
  };
  res.json({ ok: true, seeded: isSeeded(), driver: dbDriver, counts, time: new Date().toISOString() });
});

app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/catalogue', catalogueRouter);
app.use('/api/scans', scanRoutes);
app.use('/api/logs', logRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api', libraryRoutes); // /api/meta, /api/additives, /api/alternatives, /api/parse-label

app.use('/api', (req, res) => res.status(404).json({ error: 'Endpoint not found.' }));

// --- static client ---------------------------------------------------------
const dist = path.join(__dirname, '..', 'client', 'dist');
if (fs.existsSync(dist)) {
  app.use(express.static(dist, { index: false, maxAge: '1h' }));
  app.get('*', (req, res) => res.sendFile(path.join(dist, 'index.html')));
} else {
  app.get('*', (req, res) => {
    res
      .status(200)
      .type('html')
      .send(`<!doctype html><html><body style="font-family:system-ui;padding:40px;background:#0b1f1a;color:#e8f5f0">
        <h1>NutriLens API is running 🥗</h1>
        <p>The React client has not been built yet. Run <code>npm run build</code> in the project root, then reload.</p>
        <p>API health: <a style="color:#7ee2b8" href="/api/health">/api/health</a></p>
      </body></html>`);
  });
}

// --- errors ----------------------------------------------------------------
app.use((err, req, res, next) => {
  console.error('[api error]', err);
  if (res.headersSent) return next(err);
  res.status(500).json({ error: 'Something went wrong on our side.' });
});

seedIfEmpty();

const server = app.listen(PORT, '0.0.0.0', () => {
  const prod = process.env.NODE_ENV === 'production';
  console.log(`NutriLens listening on http://0.0.0.0:${PORT}  (sqlite driver: ${dbDriver}${prod ? ', production' : ''})`);
  if (prod) {
    if (!process.env.JWT_SECRET) {
      console.warn('⚠  JWT_SECRET is not set — sessions will break whenever the filesystem is reset. Set it.');
    }
    if (!process.env.PUBLIC_URL) {
      console.warn('⚠  PUBLIC_URL is not set — email links will point at localhost. Set it to your https URL.');
    }
    if (process.env.DEV_MAILBOX === 'on') {
      console.warn('⚠  DEV_MAILBOX=on in production: the mailbox is admin-only, but consider turning it off.');
    }
  }
  try {
    const c = db.prepare('SELECT COUNT(*) c FROM scans').get().c;
    const users = db.prepare('SELECT COUNT(*) c FROM users').get().c;
    if (String(process.env.SEED_DEMO ?? 'on').toLowerCase() === 'off') {
      console.log(`Fresh workspace — ${users} account(s), ${c} scans. Register the first account to become admin.`);
    } else {
      console.log(`Demo data ready — ${c} seeded scans. Sign in with demo@nutrilens.app / demo1234`);
    }
  } catch {
    /* ignore */
  }
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(
      [
        '',
        `  Port ${PORT} is already in use.`,
        '',
        `  • If NutriLens is already running, just open http://localhost:${PORT} — no need to start it twice.`,
        `  • To stop the old copy (Windows):`,
        `        netstat -ano | findstr :${PORT}`,
        `        taskkill /PID <the last number> /F`,
        `  • Or start this copy on another port:`,
        `        set PORT=${PORT + 1} && npm start        (then open http://localhost:${PORT + 1})`,
        `        PORT=${PORT + 1} npm start              (macOS / Linux)`,
        '',
      ].join('\n')
    );
    process.exit(1);
  }
  throw err;
});
