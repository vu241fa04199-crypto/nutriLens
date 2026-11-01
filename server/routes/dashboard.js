import express from 'express';
import { db, rowToLog, rowToScan } from '../db.js';
import { requireAuth } from '../auth.js';
import { DAILY_LIMITS, CONDITIONS } from '../analysis.js';
import { totalsOf } from './logs.js';
import { findAlternatives } from '../alternatives.js';

const router = express.Router();

const isoDay = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const dayOffset = (days) => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return isoDay(d);
};

router.get('/', requireAuth, (req, res) => {
  const userId = req.user.id;
  const today = String(req.query.date || isoDay(new Date()));

  const scanRows = db.prepare('SELECT * FROM scans WHERE user_id = ? ORDER BY created_at DESC').all(userId);
  const scans = scanRows.map((r) => rowToScan(r, { full: false }));

  const since7 = dayOffset(-7);
  const recentWeek = scans.filter((s) => s.createdAt.slice(0, 10) >= since7);
  const avg = (arr) => (arr.length ? Math.round(arr.reduce((a, b) => a + b.score, 0) / arr.length) : null);

  // 14-day scan trend
  const trend = [];
  for (let i = 13; i >= 0; i--) {
    const key = dayOffset(-i);
    const dayScans = scans.filter((s) => s.createdAt.slice(0, 10) === key);
    trend.push({
      date: key,
      label: new Date(`${key}T12:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }),
      avgScore: avg(dayScans),
      count: dayScans.length,
    });
  }

  // today's intake
  const todayEntries = db
    .prepare('SELECT * FROM intake_logs WHERE user_id = ? AND log_date = ? ORDER BY created_at ASC')
    .all(userId, today)
    .map(rowToLog);
  const todayTotals = totalsOf(todayEntries);

  // 7-day intake series
  const weekSeries = [];
  for (let i = 6; i >= 0; i--) {
    const key = dayOffset(-i);
    const entries = db.prepare('SELECT * FROM intake_logs WHERE user_id = ? AND log_date = ?').all(userId, key).map(rowToLog);
    weekSeries.push({
      date: key,
      label: new Date(`${key}T12:00:00`).toLocaleDateString('en-IN', { weekday: 'short' }),
      ...totalsOf(entries),
      count: entries.length,
    });
  }

  // verdict distribution
  const buckets = { everyday: 0, moderate: 0, caution: 0, high: 0, avoid: 0 };
  for (const s of scans) if (buckets[s.verdictKey] != null) buckets[s.verdictKey] += 1;

  // worst offenders (one row per product, worst score)
  const byProduct = new Map();
  for (const s of scans) {
    const key = s.productName;
    if (!byProduct.has(key) || byProduct.get(key).score < s.score) byProduct.set(key, s);
  }
  const offenders = [...byProduct.values()].sort((a, b) => b.score - a.score).slice(0, 4);

  const logDates = new Set(db.prepare('SELECT DISTINCT log_date FROM intake_logs WHERE user_id = ?').all(userId).map((r) => r.log_date));
  const trackedDays = logDates.size;

  // one concrete swap suggestion from the most recent risky scan
  const riskiest = scans.find((s) => s.score >= 40);
  let swap = null;
  if (riskiest) {
    const full = rowToScan(db.prepare('SELECT * FROM scans WHERE id = ?').get(riskiest.id));
    const alts = findAlternatives({
      category: full.category,
      tags: full.result?.tags || [],
      score: full.score,
      nutrition: full.nutrition,
      limit: 1,
    });
    if (alts[0]) swap = { scan: { id: full.id, productName: full.productName, score: full.score }, alternative: alts[0] };
  }

  const avgScore = avg(scans.slice(0, 30));
  const conditionLabels = (req.user.conditions || []).map((id) => CONDITIONS.find((c) => c.id === id)?.label || id);

  res.json({
    stats: {
      scansTotal: scans.length,
      scansThisWeek: recentWeek.length,
      avgScore,
      avgScoreThisWeek: avg(recentWeek),
      trackedDays,
      loggedToday: todayEntries.length,
      worstScore: scans.length ? Math.max(...scans.map((s) => s.score)) : null,
      bestScore: scans.length ? Math.min(...scans.map((s) => s.score)) : null,
      sugarToday: todayTotals.sugar,
      sodiumToday: todayTotals.sodium,
      kcalToday: todayTotals.kcal,
      sugarPct: Math.round((todayTotals.sugar / DAILY_LIMITS.sugar) * 100),
      sodiumPct: Math.round((todayTotals.sodium / DAILY_LIMITS.sodium) * 100),
      kcalPct: Math.round((todayTotals.kcal / DAILY_LIMITS.kcal) * 100),
      fiberToday: todayTotals.fiber,
    },
    trend,
    weekSeries,
    buckets,
    offenders,
    recentScans: scans.slice(0, 5),
    today: { date: today, entries: todayEntries, totals: todayTotals, limits: DAILY_LIMITS },
    swap,
    conditions: conditionLabels,
    limits: DAILY_LIMITS,
  });
});

export default router;
