import express from 'express';
import { db, nowISO, J, rowToScan, rowToProduct } from '../db.js';
import { requireAuth } from '../auth.js';
import { analyze, normalizeNutrition } from '../analysis.js';
import { parseIngredientAdditives } from '../additives.js';
import { findAlternatives } from '../alternatives.js';

const router = express.Router();

function buildAnalysis(user, body) {
  const nutrition = normalizeNutrition(body.nutrition || {});
  const portionG = Number(body.portionG) || Number(body.servingG) || 100;
  const servingG = Number(body.servingG) || 100;
  const ingredients = String(body.ingredients || '');
  const additives = Array.isArray(body.additives) && body.additives.length
    ? body.additives
    : parseIngredientAdditives(ingredients);
  const nova = Number(body.nova) || 4;
  const result = analyze({ nutrition, portionG, servingG, ingredients, additives, nova, user });
  return { nutrition, portionG, servingG, ingredients, additives, nova, result };
}

function validate(body) {
  const errors = [];
  if (!body.productName || String(body.productName).trim().length < 2) errors.push('Give the product a name so you can find it later.');
  const kcal = Number(body.nutrition?.kcal);
  if (!Number.isFinite(kcal) || kcal < 0 || kcal > 1000) errors.push('Energy per 100 g must be between 0 and 1000 kcal.');
  const portion = Number(body.portionG);
  if (!Number.isFinite(portion) || portion <= 0 || portion > 3000) errors.push('Portion size must be between 1 and 3000 g.');
  const anyNutrient = ['sugar', 'sodium', 'fat', 'carbs', 'protein', 'fiber'].some((k) => Number(body.nutrition?.[k]) > 0);
  if (kcal === 0 && !anyNutrient) errors.push('Enter at least some nutrition values from the label.');
  return errors;
}

// Analyse without saving — used by the Scan page before the user commits.
router.post('/analyze', requireAuth, (req, res) => {
  const errors = validate({ productName: req.body?.productName || 'Unnamed product', ...req.body });
  if (errors.length) return res.status(400).json({ error: errors[0], errors });
  const built = buildAnalysis(req.user, req.body || {});
  const alternatives = findAlternatives({
    category: req.body?.category || 'snack',
    tags: built.result.tags,
    score: built.result.score,
    nutrition: built.nutrition,
  });
  res.json({ analysis: built.result, alternatives, meta: { additives: built.additives, nova: built.nova } });
});

router.get('/', requireAuth, (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 100, 200);
  const rows = db
    .prepare('SELECT * FROM scans WHERE user_id = ? ORDER BY created_at DESC LIMIT ?')
    .all(req.user.id, limit);
  let items = rows.map((r) => rowToScan(r, { full: false }));
  const q = String(req.query.q || '').toLowerCase();
  if (q) items = items.filter((s) => `${s.productName} ${s.brand}`.toLowerCase().includes(q));
  res.json({ items });
});

router.get('/:id', requireAuth, (req, res) => {
  const row = db.prepare('SELECT * FROM scans WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
  if (!row) return res.status(404).json({ error: 'Scan not found.' });
  const scan = rowToScan(row);
  const alternatives = findAlternatives({
    category: scan.category,
    tags: scan.result?.tags || [],
    score: scan.score,
    nutrition: scan.nutrition,
  });
  res.json({ item: scan, alternatives });
});

router.post('/', requireAuth, (req, res) => {
  const errors = validate(req.body || {});
  if (errors.length) return res.status(400).json({ error: errors[0], errors });
  const b = req.body;
  const built = buildAnalysis(req.user, b);
  const info = db
    .prepare(
      `INSERT INTO scans (user_id, product_name, brand, category, portion_g, serving_g, nutrition, ingredients, additives, nova, score, verdict_key, verdict_label, result, notes, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      req.user.id, String(b.productName).trim(), String(b.brand || '').trim(), b.category || 'snack',
      built.portionG, built.servingG, J.stringify(built.nutrition), built.ingredients,
      J.stringify(built.additives), built.nova, built.result.score,
      built.result.verdict.key, built.result.verdict.label, J.stringify(built.result),
      String(b.notes || ''), nowISO()
    );
  const row = db.prepare('SELECT * FROM scans WHERE id = ?').get(info.lastInsertRowid);
  const alternatives = findAlternatives({
    category: b.category || 'snack',
    tags: built.result.tags,
    score: built.result.score,
    nutrition: built.nutrition,
  });
  res.status(201).json({ item: rowToScan(row), alternatives });
});

router.patch('/:id', requireAuth, (req, res) => {
  const row = db.prepare('SELECT * FROM scans WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
  if (!row) return res.status(404).json({ error: 'Scan not found.' });
  const scan = rowToScan(row);
  const body = req.body || {};
  const portionG = Number(body.portionG) || scan.portionG;
  const notes = body.notes !== undefined ? String(body.notes) : scan.notes;
  const needsRecompute = portionG !== scan.portionG;
  if (needsRecompute) {
    const built = buildAnalysis(req.user, {
      nutrition: scan.nutrition, portionG, servingG: scan.servingG,
      ingredients: scan.ingredients, additives: scan.additives, nova: scan.nova,
    });
    db.prepare('UPDATE scans SET portion_g = ?, score = ?, verdict_key = ?, verdict_label = ?, result = ?, notes = ? WHERE id = ?')
      .run(portionG, built.result.score, built.result.verdict.key, built.result.verdict.label, J.stringify(built.result), notes, row.id);
  } else {
    db.prepare('UPDATE scans SET notes = ? WHERE id = ?').run(notes, row.id);
  }
  const updated = db.prepare('SELECT * FROM scans WHERE id = ?').get(row.id);
  res.json({ item: rowToScan(updated) });
});

router.delete('/:id', requireAuth, (req, res) => {
  const info = db.prepare('DELETE FROM scans WHERE id = ? AND user_id = ?').run(req.params.id, req.user.id);
  if (!info.changes) return res.status(404).json({ error: 'Scan not found.' });
  res.json({ ok: true, id: Number(req.params.id) });
});

// Save a pantry product as a scan in one click
router.post('/from-product/:productId', requireAuth, (req, res) => {
  const row = db.prepare('SELECT * FROM products WHERE id = ? AND user_id = ?').get(req.params.productId, req.user.id);
  if (!row) return res.status(404).json({ error: 'Product not found.' });
  const p = rowToProduct(row);
  const built = buildAnalysis(req.user, {
    nutrition: p.nutrition, portionG: req.body?.portionG || p.servingG,
    servingG: p.servingG, ingredients: p.ingredients, additives: p.additives, nova: p.nova,
  });
  const info = db
    .prepare(
      `INSERT INTO scans (user_id, product_name, brand, category, portion_g, serving_g, nutrition, ingredients, additives, nova, score, verdict_key, verdict_label, result, notes, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      req.user.id, p.name, p.brand, p.category, built.portionG, p.servingG, J.stringify(p.nutrition),
      p.ingredients, J.stringify(built.additives), p.nova, built.result.score,
      built.result.verdict.key, built.result.verdict.label, J.stringify(built.result), '', nowISO()
    );
  const created = db.prepare('SELECT * FROM scans WHERE id = ?').get(info.lastInsertRowid);
  res.status(201).json({ item: rowToScan(created) });
});

export default router;
