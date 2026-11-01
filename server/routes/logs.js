import express from 'express';
import { db, nowISO, J, rowToLog, rowToProduct } from '../db.js';
import { requireAuth } from '../auth.js';
import { quickScore, normalizeNutrition, DAILY_LIMITS } from '../analysis.js';

const router = express.Router();

const todayKey = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const dateKeyOffset = (days) => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return todayKey(d);
};

function scale(nutrition, portionG) {
  const per100 = normalizeNutrition(nutrition);
  const f = portionG / 100;
  const out = {};
  for (const [k, v] of Object.entries(per100)) {
    out[k] = k === 'sodium' ? Math.round(v * f) : Math.round(v * f * 10) / 10;
  }
  return out;
}

function totalsOf(entries) {
  const t = { kcal: 0, sugar: 0, sodium: 0, satfat: 0, fiber: 0, protein: 0, carbs: 0, fat: 0, transFat: 0, addedSugar: 0 };
  for (const e of entries) {
    for (const k of Object.keys(t)) t[k] += Number(e.nutrition?.[k]) || 0;
  }
  for (const k of Object.keys(t)) t[k] = Math.round(t[k] * 10) / 10;
  t.sodium = Math.round(t.sodium);
  t.kcal = Math.round(t.kcal);
  return t;
}

router.get('/', requireAuth, (req, res) => {
  const date = String(req.query.date || todayKey());
  const rows = db
    .prepare('SELECT * FROM intake_logs WHERE user_id = ? AND log_date = ? ORDER BY created_at ASC')
    .all(req.user.id, date);
  const entries = rows.map(rowToLog);
  const totals = totalsOf(entries);
  res.json({
    date,
    entries,
    totals,
    limits: {
      kcal: DAILY_LIMITS.kcal,
      sugar: DAILY_LIMITS.sugar,
      sodium: DAILY_LIMITS.sodium,
      satfat: DAILY_LIMITS.satfat,
      fiber: DAILY_LIMITS.fiber,
      protein: DAILY_LIMITS.protein,
    },
  });
});

router.get('/week', requireAuth, (req, res) => {
  const end = String(req.query.end || todayKey());
  const days = [];
  const base = new Date(`${end}T12:00:00`);
  for (let i = 6; i >= 0; i--) {
    const d = new Date(base);
    d.setDate(d.getDate() - i);
    const key = todayKey(d);
    const rows = db.prepare('SELECT * FROM intake_logs WHERE user_id = ? AND log_date = ?').all(req.user.id, key);
    const entries = rows.map(rowToLog);
    days.push({ date: key, totals: totalsOf(entries), count: entries.length });
  }
  res.json({ days, limits: { sugar: DAILY_LIMITS.sugar, sodium: DAILY_LIMITS.sodium, kcal: DAILY_LIMITS.kcal } });
});

router.post('/', requireAuth, (req, res) => {
  const b = req.body || {};
  const date = String(b.date || todayKey());
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return res.status(400).json({ error: 'Invalid date.' });
  const meal = ['breakfast', 'lunch', 'dinner', 'snack'].includes(b.meal) ? b.meal : 'snack';
  const portionG = Number(b.portionG);
  if (!Number.isFinite(portionG) || portionG <= 0 || portionG > 3000) return res.status(400).json({ error: 'Portion size must be between 1 and 3000 g.' });

  let nutrition = null;
  let name = String(b.name || '').trim();
  let productId = null;
  let score = b.score != null ? Number(b.score) : null;
  let per100 = null;

  if (b.productId) {
    const row = db.prepare('SELECT * FROM products WHERE id = ? AND user_id = ?').get(b.productId, req.user.id);
    if (row) {
      const p = rowToProduct(row);
      productId = p.id;
      if (!name) name = p.name;
      per100 = p.nutrition;
      nutrition = scale(p.nutrition, portionG);
      score = quickScore(p.nutrition, p.nova, p.additives).score;
    }
  }
  if (!nutrition) {
    if (!name) return res.status(400).json({ error: 'What did you eat? Give it a name.' });
    const per =
      b.nutrition && Object.values(b.nutrition).some((v) => Number(v) > 0)
        ? b.nutrition
        : b.kcal
          ? { kcal: Number(b.kcal), sugar: Number(b.sugar) || 0, sodium: Number(b.sodium) || 0, satfat: Number(b.satfat) || 0, fat: Number(b.fat) || 0, carbs: Number(b.carbs) || 0, fiber: Number(b.fiber) || 0, protein: Number(b.protein) || 0, transFat: 0, addedSugar: Number(b.sugar) || 0 }
          : null;
    if (!per) return res.status(400).json({ error: 'Add some nutrition values, or pick a product from your pantry.' });
    nutrition = scale(per, portionG);
    if (score == null) score = quickScore(per, 3, []).score;
  } else if (name && !nutrition) {
    return res.status(400).json({ error: 'Nutrition missing.' });
  }

  const info = db
    .prepare(
      `INSERT INTO intake_logs (user_id, log_date, meal, name, product_id, portion_g, nutrition, score, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(req.user.id, date, meal, name || 'Unnamed item', productId, portionG, J.stringify(nutrition), score, nowISO());
  const row = db.prepare('SELECT * FROM intake_logs WHERE id = ?').get(info.lastInsertRowid);
  res.status(201).json({ item: rowToLog(row) });
});

router.patch('/:id', requireAuth, (req, res) => {
  const row = db.prepare('SELECT * FROM intake_logs WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
  if (!row) return res.status(404).json({ error: 'Entry not found.' });
  const entry = rowToLog(row);
  const b = req.body || {};
  const portionG = Number(b.portionG) || entry.portionG;
  const factor = portionG / (entry.portionG || 1);
  const nutrition = {};
  for (const [k, v] of Object.entries(entry.nutrition || {})) {
    nutrition[k] = k === 'sodium' ? Math.round(v * factor) : Math.round(v * factor * 10) / 10;
  }
  const meal = ['breakfast', 'lunch', 'dinner', 'snack'].includes(b.meal) ? b.meal : entry.meal;
  const name = b.name != null && String(b.name).trim() ? String(b.name).trim() : entry.name;
  const date = /^\d{4}-\d{2}-\d{2}$/.test(b.date || '') ? b.date : row.log_date;
  db.prepare('UPDATE intake_logs SET portion_g = ?, meal = ?, name = ?, log_date = ?, nutrition = ? WHERE id = ?')
    .run(portionG, meal, name, date, J.stringify(nutrition), row.id);
  const updated = db.prepare('SELECT * FROM intake_logs WHERE id = ?').get(row.id);
  res.json({ item: rowToLog(updated) });
});

router.delete('/:id', requireAuth, (req, res) => {
  const info = db.prepare('DELETE FROM intake_logs WHERE id = ? AND user_id = ?').run(req.params.id, req.user.id);
  if (!info.changes) return res.status(404).json({ error: 'Entry not found.' });
  res.json({ ok: true, id: Number(req.params.id) });
});

export default router;
export { totalsOf, todayKey, dateKeyOffset, scale };
