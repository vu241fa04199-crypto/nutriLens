import express from 'express';
import { db } from '../db.js';
import { requireAdmin } from '../auth.js';

const router = express.Router();
router.use(requireAdmin);

function userRows(q = '') {
  const like = `%${q.toLowerCase()}%`;
  return db
    .prepare(
      `SELECT u.id, u.name, u.email, u.role, u.email_verified, u.provider, u.created_at, u.last_login_at,
              u.conditions,
              (SELECT COUNT(*) FROM scans s WHERE s.user_id = u.id)        AS scans,
              (SELECT COUNT(*) FROM intake_logs l WHERE l.user_id = u.id)  AS logs,
              (SELECT COUNT(*) FROM products p WHERE p.user_id = u.id)     AS products
       FROM users u
       WHERE (? = '' OR LOWER(u.name) LIKE ? OR LOWER(u.email) LIKE ?)
       ORDER BY (u.role = 'admin') DESC, u.created_at DESC`
    )
    .all(q.trim() ? 'x' : '', like, like)
    .map((r) => ({
      id: r.id,
      name: r.name,
      email: r.email,
      role: r.role || 'user',
      emailVerified: Boolean(r.email_verified),
      provider: r.provider || 'password',
      scans: r.scans,
      logs: r.logs,
      products: r.products,
      createdAt: r.created_at,
      lastLoginAt: r.last_login_at,
    }));
}

router.get('/overview', (req, res) => {
  const one = (sql) => db.prepare(sql).get();
  const users = one('SELECT COUNT(*) c FROM users').c;
  const verified = one('SELECT COUNT(*) c FROM users WHERE email_verified = 1').c;
  const admins = one("SELECT COUNT(*) c FROM users WHERE role = 'admin'").c;
  const oauth = one("SELECT COUNT(*) c FROM users WHERE provider != 'password'").c;
  const scans = one('SELECT COUNT(*) c FROM scans').c;
  const logs = one('SELECT COUNT(*) c FROM intake_logs').c;
  const avg = db.prepare('SELECT ROUND(AVG(score)) a FROM scans').get().a || 0;

  const since = new Date(Date.now() - 6 * 864e5).toISOString().slice(0, 10);
  const rows = db
    .prepare(
      `SELECT SUBSTR(created_at, 1, 10) day, COUNT(*) c FROM scans
       WHERE SUBSTR(created_at, 1, 10) >= ? GROUP BY day`
    )
    .all(since);
  const byDay = new Map(rows.map((r) => [r.day, r.c]));
  const activity = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(Date.now() - (6 - i) * 864e5).toISOString().slice(0, 10);
    return { date: d, scans: byDay.get(d) || 0 };
  });

  const topProducts = db
    .prepare(
      `SELECT product_name name, COUNT(*) count, ROUND(AVG(score)) avgScore
       FROM scans GROUP BY product_name ORDER BY count DESC, name LIMIT 5`
    )
    .all();

  const risky = db
    .prepare(
      `SELECT product_name name, ROUND(AVG(score)) avgScore, COUNT(*) count
       FROM scans GROUP BY product_name HAVING AVG(score) >= 60 ORDER BY avgScore DESC LIMIT 5`
    )
    .all();

  res.json({
    stats: {
      users, verified, admins, oauth, scans, logs, avgScore: avg,
      verificationRate: users ? Math.round((verified / users) * 100) : 0,
    },
    activity,
    topProducts,
    risky,
    recentUsers: userRows().slice(0, 5),
  });
});

router.get('/users', (req, res) => {
  res.json({ items: userRows(String(req.query.q || '')) });
});

router.patch('/users/:id', (req, res) => {
  const id = Number(req.params.id);
  const row = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
  if (!row) return res.status(404).json({ error: 'That account no longer exists.' });

  const b = req.body || {};
  const isSelf = id === req.user.id;
  const admins = db.prepare("SELECT COUNT(*) c FROM users WHERE role = 'admin'").get().c;

  if (b.role !== undefined) {
    const role = b.role === 'admin' ? 'admin' : 'user';
    if (isSelf && role !== 'admin') {
      return res.status(400).json({ error: 'You cannot remove your own admin access.' });
    }
    if (row.role === 'admin' && role !== 'admin' && admins <= 1) {
      return res.status(400).json({ error: 'At least one admin has to remain.' });
    }
    db.prepare('UPDATE users SET role = ? WHERE id = ?').run(role, id);
  }
  if (b.emailVerified !== undefined) {
    db.prepare('UPDATE users SET email_verified = ? WHERE id = ?').run(b.emailVerified ? 1 : 0, id);
  }
  if (b.name !== undefined && String(b.name).trim()) {
    db.prepare('UPDATE users SET name = ? WHERE id = ?').run(String(b.name).trim(), id);
  }

  const updated = userRows().find((u) => u.id === id);
  res.json({ item: updated, message: `${updated.name} updated.` });
});

router.delete('/users/:id', (req, res) => {
  const id = Number(req.params.id);
  if (id === req.user.id) return res.status(400).json({ error: 'You cannot delete the account you are signed in with.' });
  const row = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
  if (!row) return res.status(404).json({ error: 'That account no longer exists.' });
  if (row.role === 'admin') {
    const admins = db.prepare("SELECT COUNT(*) c FROM users WHERE role = 'admin'").get().c;
    if (admins <= 1) return res.status(400).json({ error: 'At least one admin has to remain.' });
  }
  db.prepare('DELETE FROM users WHERE id = ?').run(id);
  res.json({ ok: true, id });
});

export default router;
