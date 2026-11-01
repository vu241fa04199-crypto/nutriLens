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
app.use(express.json({ limit: '1mb' }));

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

app.listen(PORT, '0.0.0.0', () => {
  console.log(`NutriLens listening on http://0.0.0.0:${PORT}  (sqlite driver: ${dbDriver})`);
  try {
    const c = db.prepare('SELECT COUNT(*) c FROM scans').get().c;
    console.log(`Demo data ready — ${c} seeded scans. Sign in with demo@nutrilens.app / demo1234`);
  } catch {
    /* ignore */
  }
});
