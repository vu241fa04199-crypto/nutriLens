import express from 'express';
import { db, nowISO, J, rowToProduct } from '../db.js';
import { requireAuth } from '../auth.js';
import { quickScore, normalizeNutrition } from '../analysis.js';
import { parseIngredientAdditives } from '../additives.js';

const router = express.Router();

function shape(row) {
  const p = rowToProduct(row);
  const q = quickScore(p.nutrition, p.nova, p.additives);
  const score = quickScore(p.nutrition, p.nova, [...p.additives, ...parseIngredientAdditives(p.ingredients)]);
  return { ...p, score: score.score, verdict: score.verdict };
}

function validate(body) {
  const errors = [];
  if (!body.name || String(body.name).trim().length < 2) errors.push('Product name is required.');
  if (!body.category) errors.push('Pick a category.');
  const servingG = Number(body.servingG);
  if (!Number.isFinite(servingG) || servingG <= 0 || servingG > 5000) errors.push('Serving size must be between 1 and 5000 g.');
  const kcal = Number(body.nutrition?.kcal);
  if (!Number.isFinite(kcal) || kcal < 0 || kcal > 1000) errors.push('Energy per 100 g must be between 0 and 1000 kcal.');
  return errors;
}

// ---- pantry (user-owned) ---------------------------------------------------
router.get('/', requireAuth, (req, res) => {
  const { q, category, sort } = req.query;
  let rows = db.prepare('SELECT * FROM products WHERE user_id = ? ORDER BY updated_at DESC').all(req.user.id);
  let items = rows.map(shape);
  if (q) {
    const needle = String(q).toLowerCase();
    items = items.filter((p) => `${p.name} ${p.brand} ${p.category}`.toLowerCase().includes(needle));
  }
  if (category && category !== 'all') items = items.filter((p) => p.category === category);
  if (sort === 'score') items.sort((a, b) => b.score - a.score);
  if (sort === 'score_asc') items.sort((a, b) => a.score - b.score);
  if (sort === 'name') items.sort((a, b) => a.name.localeCompare(b.name));
  res.json({ items });
});

router.get('/:id', requireAuth, (req, res) => {
  const row = db.prepare('SELECT * FROM products WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
  if (!row) return res.status(404).json({ error: 'Product not found.' });
  res.json({ item: shape(row) });
});

router.post('/', requireAuth, (req, res) => {
  const errors = validate(req.body || {});
  if (errors.length) return res.status(400).json({ error: errors[0], errors });
  const b = req.body;
  const ts = nowISO();
  const additives = Array.isArray(b.additives) && b.additives.length ? b.additives : parseIngredientAdditives(b.ingredients || '');
  const info = db
    .prepare(
      `INSERT INTO products (user_id, name, brand, category, serving_g, serving_label, nutrition, ingredients, additives, nova, emoji, notes, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      req.user.id, String(b.name).trim(), String(b.brand || '').trim(), b.category,
      Number(b.servingG), b.servingLabel || `${Number(b.servingG)} g`,
      J.stringify(normalizeNutrition(b.nutrition)), String(b.ingredients || ''),
      J.stringify(additives), Number(b.nova) || 4, b.emoji || '🍽️', b.notes || '', ts, ts
    );
  const row = db.prepare('SELECT * FROM products WHERE id = ?').get(info.lastInsertRowid);
  res.status(201).json({ item: shape(row) });
});

router.put('/:id', requireAuth, (req, res) => {
  const existing = db.prepare('SELECT * FROM products WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
  if (!existing) return res.status(404).json({ error: 'Product not found.' });
  const errors = validate(req.body || {});
  if (errors.length) return res.status(400).json({ error: errors[0], errors });
  const b = req.body;
  const current = rowToProduct(existing);
  const additives = Array.isArray(b.additives) && b.additives.length ? b.additives : parseIngredientAdditives(b.ingredients ?? current.ingredients);
  db.prepare(
    `UPDATE products SET name = ?, brand = ?, category = ?, serving_g = ?, serving_label = ?, nutrition = ?, ingredients = ?, additives = ?, nova = ?, emoji = ?, notes = ?, updated_at = ? WHERE id = ?`
  ).run(
    String(b.name).trim(), String(b.brand || '').trim(), b.category, Number(b.servingG),
    b.servingLabel || `${Number(b.servingG)} g`, J.stringify(normalizeNutrition(b.nutrition)),
    String(b.ingredients ?? ''), J.stringify(additives), Number(b.nova) || 4,
    b.emoji || current.emoji || '🍽️', b.notes ?? '', nowISO(), existing.id
  );
  const row = db.prepare('SELECT * FROM products WHERE id = ?').get(existing.id);
  res.json({ item: shape(row) });
});

router.delete('/:id', requireAuth, (req, res) => {
  const info = db.prepare('DELETE FROM products WHERE id = ? AND user_id = ?').run(req.params.id, req.user.id);
  if (!info.changes) return res.status(404).json({ error: 'Product not found.' });
  res.json({ ok: true, id: Number(req.params.id) });
});

// ---- shared catalogue (read-only, autofill source) -------------------------
export const catalogueRouter = express.Router();

catalogueRouter.get('/', requireAuth, (req, res) => {
  const q = String(req.query.q || '').toLowerCase();
  let items = db
    .prepare('SELECT * FROM products WHERE user_id IS NULL ORDER BY name')
    .all()
    .map(shape);
  if (q) items = items.filter((p) => `${p.name} ${p.brand}`.toLowerCase().includes(q));
  res.json({ items: items.slice(0, 40) });
});

catalogueRouter.post('/:id/import', requireAuth, (req, res) => {
  const row = db.prepare('SELECT * FROM products WHERE id = ? AND user_id IS NULL').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Catalogue item not found.' });
  const p = rowToProduct(row);
  const ts = nowISO();
  const info = db
    .prepare(
      `INSERT INTO products (user_id, name, brand, category, serving_g, serving_label, nutrition, ingredients, additives, nova, emoji, notes, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      req.user.id, p.name, p.brand, p.category, p.servingG, p.servingLabel,
      J.stringify(p.nutrition), p.ingredients, J.stringify(p.additives), p.nova, p.emoji,
      p.notes || '', ts, ts
    );
  const created = db.prepare('SELECT * FROM products WHERE id = ?').get(info.lastInsertRowid);
  res.status(201).json({ item: shape(created) });
});

export default router;
