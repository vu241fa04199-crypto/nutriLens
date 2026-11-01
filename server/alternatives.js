import { db, rowToAlternative } from './db.js';
import { quickScore, normalizeNutrition } from './analysis.js';

const pct = (a, b) => (b > 0 ? Math.round(((b - a) / b) * 100) : 0);

/**
 * Rank healthier swaps for a scanned item.
 * Matches on category first, then on the problems the scan actually has.
 */
export function findAlternatives({ category, tags = [], score = 50, nutrition = {}, limit = 4 }) {
  const rows = db.prepare('SELECT * FROM alternatives').all().map(rowToAlternative);
  const base = normalizeNutrition(nutrition);

  const ranked = rows
    .map((a) => {
      const q = quickScore(a.nutrition, a.nova, []);
      let relevance = 0;
      if (a.category === category) relevance += 8;
      const overlap = a.tags.filter((t) => tags.includes(t));
      relevance += overlap.length * 4;
      relevance += (100 - q.score) / 12;
      const an = normalizeNutrition(a.nutrition);
      const deltas = {
        kcal: pct(an.kcal, base.kcal),
        sugar: pct(an.sugar, base.sugar),
        sodium: pct(an.sodium, base.sodium),
        satfat: pct(an.satfat, base.satfat),
        fiber: base.fiber > 0 ? Math.round(((an.fiber - base.fiber) / base.fiber) * 100) : an.fiber > 0 ? 100 : 0,
      };
      return {
        ...a,
        score: q.score,
        verdict: q.verdict,
        relevance,
        matchedTags: overlap,
        deltas,
        improvement: Math.max(score - q.score, 0),
      };
    })
    .filter((a) => a.relevance > 8 && a.score < score - 4)
    .sort((x, y) => y.relevance - x.relevance || x.score - y.score)
    .slice(0, limit)
    .map(({ relevance, ...rest }) => rest);

  return ranked;
}
