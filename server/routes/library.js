import express from 'express';
import { db, rowToAlternative } from '../db.js';
import { requireAuth } from '../auth.js';
import { ADDITIVES, parseIngredientAdditives } from '../additives.js';
import { CATEGORIES } from '../seed-data.js';
import { CONDITIONS, DAILY_LIMITS, VERDICTS } from '../analysis.js';
import { parseLabelText } from '../parse-label.js';
import { quickScore } from '../analysis.js';

const router = express.Router();

router.get('/meta', requireAuth, (req, res) => {
  res.json({
    categories: CATEGORIES,
    conditions: CONDITIONS,
    limits: DAILY_LIMITS,
    verdicts: VERDICTS,
  });
});

router.get('/additives', requireAuth, (req, res) => {
  const q = String(req.query.q || '').toLowerCase();
  let items = ADDITIVES.map((a) => ({
    code: a.code, name: a.name, category: a.category, level: a.level, what: a.what, why: a.why, found: a.found,
  }));
  if (q) items = items.filter((a) => `${a.code} ${a.name} ${a.category} ${a.why}`.toLowerCase().includes(q));
  res.json({ items, total: items.length });
});

router.get('/alternatives', requireAuth, (req, res) => {
  const category = String(req.query.category || '');
  let items = db.prepare('SELECT * FROM alternatives').all().map(rowToAlternative);
  if (category && category !== 'all') items = items.filter((a) => a.category === category);
  items = items
    .map((a) => ({ ...a, ...quickScore(a.nutrition, a.nova, []) }))
    .sort((x, y) => x.score - y.score);
  res.json({ items });
});

// Paste-a-label parser (used by the Scan page "smart paste" box)
router.post('/parse-label', requireAuth, (req, res) => {
  const text = String(req.body?.text || '');
  if (text.trim().length < 8) return res.status(400).json({ error: 'Paste the nutrition table text first.' });
  const parsed = parseLabelText(text);
  const additives = parseIngredientAdditives(parsed.ingredients || text);
  res.json({ ...parsed, additives });
});

export default router;
