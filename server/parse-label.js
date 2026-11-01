// Best-effort parser for a pasted nutrition table + ingredient list.
const FIELD_MATCHERS = [
  ['addedSugar', /added\s*sugar/i],
  ['satfat', /saturat/i],
  ['transFat', /trans\s*fat/i],
  ['fiber', /fib(er|re)|dietary\s*fib/i],
  ['protein', /protein/i],
  ['carbs', /carbohydrat|carbs/i],
  ['sugar', /sugar/i],
  ['salt', /\bsalt\b/i],
  ['sodium', /sodium|\bna\b/i],
  ['kcal', /energy|calorie/i],
  ['fat', /\bfat\b|total\s*fat/i],
];

const NUM_UNIT = /([A-Za-z()%/.&\-\s]{2,45}?)[\s:–-]*(\d+(?:[.,]\d+)?)\s*(kcal|kj|mg|g|ml)\b/gi;

function toNumber(s) {
  return Number(String(s).replace(',', '.'));
}

export function parseLabelText(raw = '') {
  const text = String(raw);
  const found = {};
  const nutrition = {};
  let unitKcal = 'kcal';

  // ingredient list, if it is pasted after the table
  let ingredients = '';
  const ingMatch = text.match(/(ingredients?|ingredient list)\s*[:\-–]\s*([\s\S]+)/i);
  if (ingMatch) ingredients = ingMatch[2].trim().replace(/\s+/g, ' ').slice(0, 600);

  // serving size
  let servingG = null;
  const serveMatch = text.match(/serv(?:e|ing)?\s*size\s*[:\-–]?\s*(\d+(?:[.,]\d+)?)\s*(g|ml)/i);
  if (serveMatch) servingG = toNumber(serveMatch[1]);
  const perServingOnly = /per\s*serv(?:e|ing)/i.test(text) && !/per\s*100\s*(g|ml)/i.test(text);

  for (const m of text.matchAll(NUM_UNIT)) {
    // Column headers ("%RDA per serve", "per 100 g", "Nutrients") sit directly above
    // the first data row on most Indian labels, so they get glued onto that row's
    // label by the regex — strip them before deciding what the row means.
    const label = m[1]
      .trim()
      .toLowerCase()
      .replace(/%?\s*rda\s*(per\s*serve?r?[a-z]*)?/g, ' ')
      .replace(/per\s*100\s*(g|ml|gram)?/g, ' ')
      .replace(/%\s*/g, ' ')
      .replace(/\bnutrients?\b/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    const value = toNumber(m[2]);
    const unit = m[3].toLowerCase();
    if (!label || /(serving|serv\b|size|each|pack|piece|tub|bottle)/.test(label)) continue;
    const field = FIELD_MATCHERS.find(([, re]) => re.test(label));
    if (!field) continue;
    const key = field[0];
    if (found[key] !== undefined) continue; // first match wins

    if (key === 'kcal' && unit === 'kj') {
      nutrition.kcal = Math.round(value / 4.184);
      unitKcal = 'kj';
    } else if (key === 'kcal') {
      nutrition.kcal = Math.round(value);
    } else if (key === 'sodium' && unit === 'g') {
      nutrition.sodium = Math.round(value * 1000);
    } else if (key === 'salt' && unit === 'g') {
      nutrition.sodium = Math.round(value * 400);
    } else if (key === 'salt' && unit === 'mg') {
      nutrition.sodium = Math.round(value * 0.4);
    } else if (key === 'transFat' && unit === 'mg') {
      nutrition.transFat = Math.round((value / 1000) * 100) / 100;
    } else {
      nutrition[key] = Math.round(value * 10) / 10;
    }
    found[key] = true;
  }

  if (perServingOnly && servingG && servingG > 0) {
    const f = 100 / servingG;
    for (const [k, v] of Object.entries(nutrition)) {
      nutrition[k] = k === 'sodium' ? Math.round(v * f) : Math.round(v * f * 10) / 10;
    }
  }

  if (nutrition.addedSugar == null && nutrition.sugar != null) nutrition.addedSugar = nutrition.sugar;

  const addCount = (ingredients.match(/\b(\d{3}[a-z]?)\b|flavou?r enhancer|preservative|colou?r|emulsifier|antioxidant|sweetener/g) || []).length;
  const nova = ingredients
    ? addCount >= 2 || /refined|maida|palm oil|hydrogenated|syrup/i.test(ingredients) ? 4 : addCount >= 1 ? 3 : 2
    : 4;

  const confidence = Object.keys(found).length;
  return {
    nutrition,
    ingredients,
    servingG,
    nova,
    detectedFields: Object.keys(found),
    confidence: confidence >= 6 ? 'high' : confidence >= 3 ? 'medium' : 'low',
    note: confidence < 3 ? 'We could only read a few values — please check the fields before analysing.' : null,
    unitKcal,
  };
}
