// ============================================================================
// NutriLens analysis engine
// Turns a nutrition panel + ingredient list + the user's health profile into
// a risk score, a long-term consequence report, a safe daily allowance and
// the "flags" used to find healthier alternatives.
// ============================================================================

import { resolveAdditives, parseIngredientAdditives, scanIngredientWords, publicAdditive } from './additives.js';

export const EMPTY_NUTRITION = {
  kcal: 0, protein: 0, carbs: 0, sugar: 0, addedSugar: 0,
  fiber: 0, fat: 0, satfat: 0, transFat: 0, sodium: 0,
};

// Daily reference limits for an average adult (WHO / ICMR-NIN style guidance)
export const DAILY_LIMITS = {
  sugar: 50,        // g free sugars (10% of 2000 kcal) — ideal is 25 g
  sugarIdeal: 25,
  sodium: 2000,     // mg
  satfat: 20,       // g (10% of 2000 kcal)
  transFat: 2,      // g — WHO says aim for <1% of energy
  fiber: 30,        // g — minimum target
  protein: 55,      // g — reference for a 65 kg adult
  kcal: 2000,
  snackKcal: 500,   // a single snack should stay under ~25% of daily energy
  salt: 5,          // g
};

const NUTRIENT_META = {
  kcal: { label: 'Energy', unit: 'kcal', limit: DAILY_LIMITS.kcal },
  sugar: { label: 'Total sugar', unit: 'g', limit: DAILY_LIMITS.sugar },
  addedSugar: { label: 'Added sugar', unit: 'g', limit: DAILY_LIMITS.sugarIdeal },
  sodium: { label: 'Sodium', unit: 'mg', limit: DAILY_LIMITS.sodium },
  satfat: { label: 'Saturated fat', unit: 'g', limit: DAILY_LIMITS.satfat },
  transFat: { label: 'Trans fat', unit: 'g', limit: DAILY_LIMITS.transFat },
  fat: { label: 'Total fat', unit: 'g', limit: 70 },
  carbs: { label: 'Carbohydrate', unit: 'g', limit: 275 },
  fiber: { label: 'Fibre', unit: 'g', limit: DAILY_LIMITS.fiber },
  protein: { label: 'Protein', unit: 'g', limit: DAILY_LIMITS.protein },
};

const n = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);
const clamp = (v, a = 0, b = 100) => Math.max(a, Math.min(b, v));
const round = (v, d = 1) => {
  const f = 10 ** d;
  return Math.round((Number(v) || 0) * f) / f;
};

export function normalizeNutrition(input = {}) {
  const src = { ...EMPTY_NUTRITION };
  for (const key of Object.keys(EMPTY_NUTRITION)) src[key] = n(input[key]);
  // Indian labels sometimes only give salt. 1 g salt ≈ 400 mg sodium.
  if (!src.sodium && n(input.salt)) src.sodium = round(n(input.salt) * 400, 0);
  if (!src.addedSugar && src.sugar && input.addedSugar !== 0) src.addedSugar = 0;
  if (src.addedSugar > src.sugar) src.addedSugar = src.sugar;
  if (src.satfat > src.fat) src.satfat = src.fat;
  return src;
}

// ---------------------------------------------------------------------------
// Component scores (0 = great, 100 = terrible)
// ---------------------------------------------------------------------------
function sugarScore(v) {
  if (v <= 5) return (v / 5) * 15;
  if (v <= 22.5) return 15 + ((v - 5) / 17.5) * 45;
  return clamp(60 + ((v - 22.5) / 30) * 40);
}
function sodiumScore(v) {
  if (v <= 120) return (v / 120) * 15;
  if (v <= 600) return 15 + ((v - 120) / 480) * 45;
  return clamp(60 + ((v - 600) / 1400) * 40);
}
function satfatScore(v) {
  if (v <= 1.5) return (v / 1.5) * 15;
  if (v <= 5) return 15 + ((v - 1.5) / 3.5) * 45;
  return clamp(60 + ((v - 5) / 15) * 40);
}
function transFatScore(v) {
  if (v <= 0.05) return 0;
  if (v < 0.5) return 55;
  return clamp(75 + ((v - 0.5) / 2) * 25);
}
function energyScore(v) {
  if (v <= 150) return (v / 150) * 10;
  if (v <= 400) return 10 + ((v - 150) / 250) * 55;
  return clamp(65 + ((v - 400) / 300) * 35);
}
function fiberScore(v) {
  if (v >= 6) return clamp(20 - ((v - 6) / 6) * 20);
  if (v >= 3) return 35 + ((6 - v) / 3) * 20;
  return clamp(55 + ((3 - v) / 3) * 45);
}
function additiveRiskScore(additives) {
  let s = 0;
  for (const a of additives) {
    if (a.level === 'high') s += 30;
    else if (a.level === 'medium') s += 12;
    else s += 2;
  }
  return clamp(s);
}
function processingScore(nova) {
  const map = { 1: 0, 2: 15, 3: 45, 4: 85 };
  return map[Number(nova)] ?? 45;
}

export const COMPONENT_WEIGHTS = {
  sugar: 0.22, sodium: 0.17, satfat: 0.12, transFat: 0.07,
  energy: 0.13, fiber: 0.11, additives: 0.10, processing: 0.08,
};

export const COMPONENT_LABELS = {
  sugar: 'Sugar load',
  sodium: 'Sodium load',
  satfat: 'Saturated fat',
  transFat: 'Trans fat',
  energy: 'Calorie density',
  fiber: 'Low fibre',
  additives: 'Additive load',
  processing: 'Ultra-processing',
};

export const VERDICTS = [
  { max: 19, key: 'everyday', label: 'Everyday friendly', tone: 'emerald', blurb: 'A reasonable everyday choice — keep portions sensible.' },
  { max: 39, key: 'moderate', label: 'Okay in moderation', tone: 'lime', blurb: 'Fine a few times a week, not a daily habit.' },
  { max: 59, key: 'caution', label: 'Keep it occasional', tone: 'amber', blurb: 'Limit to once or twice a week — it adds up fast.' },
  { max: 79, key: 'high', label: 'High risk', tone: 'orange', blurb: 'Treat food. Daily use pushes you toward chronic disease.' },
  { max: 100, key: 'avoid', label: 'Avoid as a habit', tone: 'red', blurb: 'Best reserved for rare occasions — consider a swap.' },
];

export function verdictFor(score) {
  return VERDICTS.find((v) => score <= v.max) || VERDICTS[VERDICTS.length - 1];
}

const FREQUENCY = {
  everyday: { text: 'Most days are fine', detail: 'Eat freely as part of balanced meals.' },
  moderate: { text: '2–3 times a week', detail: 'Pair with fibre and protein to soften the glucose spike.' },
  caution: { text: 'Once or twice a week', detail: 'Keep servings small and avoid stacking with other treats the same day.' },
  high: { text: 'Once a week at most', detail: 'Not a daily snack. Never as a meal replacement.' },
  avoid: { text: 'Rare treat — twice a month', detail: 'Swap for a whole-food alternative most days.' },
};

// ---------------------------------------------------------------------------
// Health-condition profiles
// ---------------------------------------------------------------------------
export const CONDITIONS = [
  { id: 'diabetes', label: 'Diabetes / pre-diabetes', icon: 'droplet', blurb: 'Blood-sugar control is the priority.' },
  { id: 'obesity', label: 'Overweight / obesity', icon: 'scale', blurb: 'Energy density and satiety matter most.' },
  { id: 'hypertension', label: 'High blood pressure', icon: 'heart', blurb: 'Sodium is the key lever.' },
  { id: 'heart', label: 'High cholesterol / heart disease', icon: 'activity', blurb: 'Watch saturated and trans fat.' },
  { id: 'fattyliver', label: 'Fatty liver', icon: 'liver', blurb: 'Fructose and alcohol-free sugar load.' },
  { id: 'pcos', label: 'PCOS', icon: 'sparkles', blurb: 'Insulin spikes worsen symptoms.' },
  { id: 'kidney', label: 'Kidney disease', icon: 'filter', blurb: 'Sodium and phosphorus add load.' },
  { id: 'cancer', label: 'Cancer risk / survivor', icon: 'shield', blurb: 'Additives and ultra-processing matter most.' },
  { id: 'gut', label: 'IBS / gut sensitivity', icon: 'leaf', blurb: 'Emulsifiers and additives irritate the gut.' },
  { id: 'gout', label: 'Gout', icon: 'flame', blurb: 'Purine-rich flavour enhancers matter.' },
];

const CONDITION_NOTES = {
  diabetes: (p, s) => [
    s.sugar > 30 && `This is a high-sugar food (${round(p.sugar, 1)} g sugar per serving). It hits the bloodstream in minutes because there is almost no fibre or protein to slow absorption.`,
    s.carbs > 50 && `${round(p.carbs, 0)} g of mostly refined carbohydrate per serving behaves like a sugar load once digested.`,
    `Repeated glucose spikes are what drive HbA1c upward and worsen insulin resistance over months — the mechanism behind type-2 progression.`,
  ],
  obesity: (p, s) => [
    p.kcal > 150 && `At ${round(p.kcal, 0)} kcal per serving this food is calorie-dense but not filling — the classic combination behind silent weight gain.`,
    s.sugar > 30 && 'Liquid/refined sugar does not trigger the same fullness signals as whole food, so you eat more afterwards.',
  ],
  hypertension: (p, s) => [
    s.sodium > 50 && `${round(p.sodium, 0)} mg sodium in one serving is ${Math.round((p.sodium / DAILY_LIMITS.sodium) * 100)}% of the recommended daily cap.`,
    'Habitual excess sodium stiffens blood vessels; population studies link a 1 g/day sodium reduction to roughly a 3–5 mmHg drop in blood pressure.',
  ],
  heart: (p, s) => [
    s.satfat > 50 && `${round(p.satfat, 1)} g saturated fat per serving — saturated fat raises LDL ("bad") cholesterol.`,
    p.transFat > 0.1 && 'Even small amounts of industrial trans fat raise LDL and lower HDL — the worst fat combination for arteries.',
  ],
  fattyliver: (p, s) => [
    s.sugar > 30 && 'Refined sugar and syrups are largely metabolised by the liver, where excess is converted to fat — the direct route to fatty liver.',
  ],
  pcos: (p, s) => [
    s.sugar > 30 && 'High-glycaemic foods raise insulin, which in PCOS pushes ovaries to make more testosterone and worsens acne, hair and cycle irregularity.',
  ],
  kidney: (p, s) => [
    s.sodium > 50 && 'A high sodium load increases blood pressure and forces the kidneys to work harder to excrete it.',
  ],
  cancer: (p, s) => [
    s.additives > 40 && 'Contains additives flagged in this report; ultra-processed foods are the exposure route most studied for long-term risk.',
  ],
  gut: (p, s) => [
    s.additives > 30 && 'Emulsifiers and thickeners used in products like this have been linked to a thinner protective mucus layer in the gut.',
  ],
  gout: (p, s) => [
    s.additives > 30 && 'Flavour enhancers such as disodium ribonucleotides are purine sources that can trigger gout flares.',
  ],
};

// ---------------------------------------------------------------------------
// Main analysis
// ---------------------------------------------------------------------------
/**
 * @param {object} opts
 * @param {object} opts.nutrition  per 100 g/ml values
 * @param {number} opts.portionG   grams consumed in one sitting
 * @param {number} opts.servingG   grams in one label serving
 * @param {string} opts.ingredients
 * @param {string[]} opts.additives explicit additive codes
 * @param {number} opts.nova
 * @param {object} opts.user       { conditions: string[], weightKg }
 */
export function analyze(opts = {}) {
  const per100 = normalizeNutrition(opts.nutrition);
  const portionG = n(opts.portionG) || n(opts.servingG) || 100;
  const servingG = n(opts.servingG) || 100;
  const user = opts.user || {};
  const conditions = Array.isArray(user.conditions) ? user.conditions : [];

  const ingredients = String(opts.ingredients || '');
  const explicit = Array.isArray(opts.additives) ? opts.additives : [];
  const detected = parseIngredientAdditives(ingredients);
  const additives = resolveAdditives([...explicit, ...detected]);

  const per = (v) => round((n(v) * portionG) / 100, 2);
  const p = {
    kcal: per(per100.kcal), protein: per(per100.protein), carbs: per(per100.carbs),
    sugar: per(per100.sugar), addedSugar: per(per100.addedSugar), fiber: per(per100.fiber),
    fat: per(per100.fat), satfat: per(per100.satfat), transFat: per(per100.transFat),
    sodium: Math.round(n(per100.sodium) * portionG / 100),
  };
  p.salt = round((p.sodium * 2.5) / 1000, 2);

  // --- component score card ------------------------------------------------
  const components = {
    sugar: sugarScore(per100.sugar),
    sodium: sodiumScore(per100.sodium),
    satfat: satfatScore(per100.satfat),
    transFat: transFatScore(per100.transFat),
    energy: energyScore(per100.kcal),
    fiber: fiberScore(per100.fiber),
    additives: additiveRiskScore(additives),
    processing: processingScore(opts.nova),
  };

  let base = 0;
  for (const [k, w] of Object.entries(COMPONENT_WEIGHTS)) base += components[k] * w;

  // --- personalised adjustments -------------------------------------------
  let adj = 0;
  const has = (id) => conditions.includes(id);
  if (has('diabetes')) adj += components.sugar * 0.1 + components.energy * 0.04;
  if (has('obesity')) adj += components.energy * 0.05 + components.sugar * 0.04;
  if (has('hypertension') || has('kidney')) adj += components.sodium * 0.1;
  if (has('heart')) adj += components.satfat * 0.07 + components.transFat * 0.1;
  if (has('fattyliver') || has('pcos')) adj += components.sugar * 0.07;
  if (has('cancer')) adj += components.additives * 0.07 + components.processing * 0.05;
  if (has('gut')) adj += components.additives * 0.05;
  if (has('gout')) adj += (additives.some((a) => ['627', '631', '635'].includes(a.code)) ? 8 : 0);

  let score = base + clamp(adj, 0, 20);

  // hard floors: some things should never score "safe"
  if (per100.transFat > 0.2) score = Math.max(score, 58);
  if (p.transFat >= 0.5) score = Math.max(score, 70);
  if (additives.filter((a) => a.level === 'high').length >= 2) score = Math.max(score, 52);
  if (per100.sugar >= 30) score = Math.max(score, 58);
  if (per100.sodium >= 1200) score = Math.max(score, 62);
  if (per100.sugar <= 5 && per100.sodium <= 120 && per100.fiber >= 3 && Number(opts.nova) === 1)
    score = Math.min(score, 18);

  score = Math.round(clamp(score));
  const verdict = verdictFor(score);
  const frequency = FREQUENCY[verdict.key];

  const drivers = Object.entries(components)
    .map(([key, value]) => ({ key, label: COMPONENT_LABELS[key], score: Math.round(value), weight: COMPONENT_WEIGHTS[key] }))
    .sort((a, b) => b.score * b.weight - a.score * a.weight)
    .map((d) => ({ ...d, impact: Math.round(d.score * d.weight) }));

  // --- safe daily allowance ------------------------------------------------
  const limiting = [];
  const consider = (key, limit, label) => {
    const v = n(per100[key]);
    if (v <= 0) return;
    const grams = (limit / v) * 100;
    limiting.push({ key, label, limit, unit: NUTRIENT_META[key]?.unit || 'g', per100: v, gramsAllowed: grams });
  };
  consider('sugar', DAILY_LIMITS.sugar, 'Total sugar');
  consider('sodium', DAILY_LIMITS.sodium, 'Sodium');
  consider('satfat', DAILY_LIMITS.satfat, 'Saturated fat');
  consider('transFat', 1, 'Trans fat');
  consider('kcal', DAILY_LIMITS.snackKcal, 'Energy (snack budget)');
  limiting.sort((a, b) => a.gramsAllowed - b.gramsAllowed);

  const bind = limiting[0];
  let gramsPerDay = bind ? bind.gramsAllowed : 100;
  gramsPerDay = Math.min(gramsPerDay, 1000);
  // an "allowance" of 400 g of junk still isn't advice — cap by verdict
  const verdictCap = { everyday: 1000, moderate: 250, caution: 120, high: 60, avoid: 30 }[verdict.key];
  gramsPerDay = Math.min(gramsPerDay, verdictCap);
  const gramsRounded = gramsPerDay >= 100 ? Math.round(gramsPerDay / 10) * 10 : Math.round(gramsPerDay / 5) * 5;
  const servingsPerDay = round(gramsRounded / servingG, 1);

  const dailyAllowance = {
    grams: Math.max(gramsRounded, 0),
    servings: Math.max(servingsPerDay, 0),
    servingG,
    limitingNutrient: bind ? bind.label : null,
    limiting: limiting.slice(0, 5).map((l) => ({
      key: l.key,
      label: l.label,
      limit: l.limit,
      unit: l.unit,
      per100: round(l.per100, 2),
      gramsAllowed: Math.round(l.gramsAllowed),
      isBinding: bind && l.key === bind.key,
    })),
    frequency: frequency.text,
    frequencyDetail: frequency.detail,
    perServingPctSugar: Math.round((p.sugar / DAILY_LIMITS.sugar) * 100),
    perServingPctSodium: Math.round((p.sodium / DAILY_LIMITS.sodium) * 100),
    perServingPctSatfat: Math.round((p.satfat / DAILY_LIMITS.satfat) * 100),
    perServingPctEnergy: Math.round((p.kcal / DAILY_LIMITS.kcal) * 100),
  };

  // --- percentage of daily limits (for the UI bars) -----------------------
  const dailyPercent = Object.entries(NUTRIENT_META).map(([key, meta]) => ({
    key,
    label: meta.label,
    unit: meta.unit,
    value: round(p[key], key === 'sodium' || key === 'kcal' ? 0 : 1),
    limit: meta.limit,
    percent: Math.round((n(p[key]) / meta.limit) * 100),
    positive: ['fiber', 'protein'].includes(key),
  }));

  // --- consequences --------------------------------------------------------
  const consequences = [];
  const add = (c) => consequences.push({ id: c.id, title: c.title, severity: c.severity, horizon: c.horizon, detail: c.detail, evidence: c.evidence });

  const tsp = round(p.sugar / 4, 1);
  const yearlyKg = round((p.kcal * 365) / 7700, 1);

  if (components.sugar >= 45) {
    add({
      id: 'sugar-spike',
      title: 'Sharp blood-sugar spike',
      severity: components.sugar >= 70 ? 'high' : 'medium',
      horizon: '30–60 minutes after eating',
      detail: `This serving carries about ${tsp} teaspoons of free sugar (${round(p.sugar, 1)} g) with little fibre or protein to slow it down. Glucose rises quickly, then crashes — the hunger, irritability and craving for another serving that follows is physiology, not weakness.`,
      evidence: 'WHO free-sugars guidance: keep added sugar under 10% of energy, ideally 5%.',
    });
  }
  if (components.sugar >= 60) {
    add({
      id: 'insulin-resistance',
      title: 'Falling insulin sensitivity',
      severity: 'high',
      horizon: '6 months – 3 years of regular use',
      detail: `At this sugar load once a day you would take in roughly ${round((p.sugar * 365) / 1000, 1)} kg of free sugar a year. Repeating this cycle forces the pancreas to pump out more insulin for the same meal; when cells stop responding, pre-diabetes starts.`,
      evidence: 'Sugar-sweetened beverage intake is associated with a 26% higher risk of type-2 diabetes in cohort meta-analyses.',
    });
  }
  if (p.kcal >= 100 && p.kcal <= 450 && (components.sugar >= 40 || components.satfat >= 40 || components.energy >= 55)) {
    const weeklyKg = round((p.kcal * 3 * 52) / 7700, 1);
    add({
      id: 'weight',
      title: `About ${Math.min(yearlyKg, 20)} kg of fat a year, if it becomes a daily habit`,
      severity: yearlyKg >= 5 ? 'high' : yearlyKg >= 2.5 ? 'medium' : 'low',
      horizon: 'Over 12 months',
      detail: `A ${Math.round(portionG)} g serving is ${round(p.kcal, 0)} kcal. Eaten on top of what you already eat, that is ~${yearlyKg} kg of body fat in a year (~7,700 kcal per kg); even three times a week is ~${weeklyKg} kg. Nothing feels different day to day — which is exactly why it works.`,
      evidence: 'Energy-balance arithmetic: small daily surpluses compound into the population-level weight gain seen over decades.',
    });
  }
  if (components.sodium >= 55) {
    add({
      id: 'blood-pressure',
      title: 'Blood pressure creep',
      severity: components.sodium >= 75 ? 'high' : 'medium',
      horizon: '1–5 years',
      detail: `One serving supplies ${p.sodium} mg sodium — ${dailyAllowance.perServingPctSodium}% of the 2,000 mg daily cap (${p.salt} g salt). Two servings a day and you are already over the limit before you add a single meal. Chronically stiff arteries raise stroke and kidney risk quietly, with no symptoms.`,
      evidence: 'WHO: <2 g sodium/day. Salt-reduction trials show ~4–5 mmHg systolic drop per 4.4 g/day reduction.',
    });
  }
  if (p.transFat > 0.1 || components.satfat >= 60) {
    add({
      id: 'cholesterol',
      title: 'LDL cholesterol and arterial plaque',
      severity: p.transFat > 0.1 ? 'high' : 'medium',
      horizon: '2–10 years',
      detail: `${round(p.satfat, 1)} g saturated${p.transFat > 0.1 ? ` and ${round(p.transFat, 2)} g trans` : ''} fat per serving. Saturated fat raises LDL; industrial trans fat raises LDL *and* lowers the protective HDL. Fatty streaks in arteries begin in the teens and twenties and stay silent for decades.`,
      evidence: 'Replacing 5% of energy from saturated with unsaturated fat lowers LDL by ~0.35 mmol/L (Cochrane). WHO targets zero industrial trans fat.',
    });
  }
  if (components.fiber >= 55 && components.processing >= 45) {
    add({
      id: 'gut',
      title: 'Hungrier gut, poorer microbiome',
      severity: 'medium',
      horizon: 'Weeks to months',
      detail: `Only ${round(p.fiber, 1)} g fibre per serving, so nothing feeds your gut bacteria or slows digestion. Low-fibre, soft, highly refined foods leave you hungry within 90 minutes and shrink the diversity of your microbiome — which is tied to inflammation and metabolic health.`,
      evidence: 'Fibre intake is one of the strongest dietary predictors of all-cause mortality; most adults get half the 30 g target.',
    });
  }
  const highRiskAdditives = additives.filter((a) => a.level === 'high');
  if (highRiskAdditives.length || (Number(opts.nova) === 4 && p.sodium > 300)) {
    add({
      id: 'additives',
      title: 'Long-term additive and ultra-processing exposure',
      severity: highRiskAdditives.length ? 'high' : 'medium',
      horizon: '5–20 years',
      detail: highRiskAdditives.length
        ? `This product contains ${highRiskAdditives.map((a) => a.name).join(', ')}. ${highRiskAdditives[0].why}`
        : 'This is a NOVA class 4 ultra-processed food: industrially formulated with flavours, colours and emulsifiers you would not use at home.',
      evidence: 'BMJ 2024 umbrella review of 45 meta-analyses: higher ultra-processed food intake associated with 50% higher cardiovascular mortality and 12% higher type-2 diabetes risk.',
    });
  }
  if (p.sodium >= 400 && (additives.some((a) => a.code === '338'))) {
    add({
      id: 'kidney',
      title: 'Kidney and bone load',
      severity: 'medium',
      horizon: 'Years',
      detail: 'Phosphoric acid plus a high sodium load is the cola pattern linked to lower bone mineral density and a higher risk of kidney stones, and it is a real concern for anyone with reduced kidney function.',
      evidence: 'Framingham Osteoporosis Study: daily cola intake associated with lower hip bone density in women.',
    });
  }
  if (components.sugar >= 45 && /citric|330|phosphoric|338|carbonated/i.test(ingredients)) {
    add({
      id: 'teeth',
      title: 'Tooth enamel erosion',
      severity: 'low',
      horizon: '1–3 years',
      detail: 'Sugar feeds cavity-causing bacteria while the acid (citric/phosphoric) softens enamel. Sipping slowly through the day is worse than eating it with a meal.',
      evidence: 'Frequent sugar plus acid exposure is the main dietary driver of dental erosion.',
    });
  }
  if (!consequences.length) {
    add({
      id: 'clean',
      title: 'No red flags found',
      severity: 'low',
      horizon: 'Ongoing',
      detail: 'Sugar, sodium, saturated fat and fibre all sit in a healthy range per 100 g, and we found no additives of concern in the ingredient list. This is what a genuinely everyday food looks like.',
      evidence: 'Front-of-pack nutrient profiling thresholds (UK FSA model).',
    });
  }

  // --- positives -----------------------------------------------------------
  const positives = [];
  if (per100.fiber >= 4) positives.push({ label: `Good fibre: ${round(p.fiber, 1)} g per serving`, key: 'fiber' });
  if (per100.protein >= 8) positives.push({ label: `Solid protein: ${round(p.protein, 1)} g per serving`, key: 'protein' });
  if (per100.sugar <= 5) positives.push({ label: 'Low in sugar', key: 'sugar' });
  if (per100.sodium <= 120) positives.push({ label: 'Low in sodium', key: 'sodium' });
  if (per100.satfat <= 1.5) positives.push({ label: 'Low in saturated fat', key: 'satfat' });
  if (!additives.some((a) => a.level !== 'low')) positives.push({ label: 'No additives of concern', key: 'additives' });
  if (Number(opts.nova) === 1) positives.push({ label: 'Unprocessed / whole food', key: 'nova' });

  // --- condition-specific personalised warnings ---------------------------
  const conditionReports = conditions.map((id) => {
    const meta = CONDITIONS.find((c) => c.id === id);
    if (!meta) return null;
    const notes = (CONDITION_NOTES[id] ? CONDITION_NOTES[id](p, components) : []).filter(Boolean);
    let severity = 'low';
    if (id === 'diabetes' || id === 'fattyliver' || id === 'pcos') severity = components.sugar >= 60 ? 'high' : components.sugar >= 40 ? 'medium' : 'low';
    if (id === 'hypertension' || id === 'kidney') severity = components.sodium >= 60 ? 'high' : components.sodium >= 35 ? 'medium' : 'low';
    if (id === 'heart') severity = Math.max(components.satfat, components.transFat) >= 60 ? 'high' : components.satfat >= 35 ? 'medium' : 'low';
    if (id === 'obesity') severity = components.energy >= 55 || components.sugar >= 60 ? 'high' : components.energy >= 35 ? 'medium' : 'low';
    if (id === 'cancer') severity = components.additives >= 50 || components.processing >= 60 ? 'high' : 'medium';
    if (id === 'gut') severity = components.additives >= 40 ? 'medium' : 'low';
    if (id === 'gout') severity = additives.some((a) => ['627', '631', '635'].includes(a.code)) ? 'medium' : 'low';
    return {
      id,
      label: meta.label,
      severity,
      headline: severity === 'high' ? 'Actively works against your condition' : severity === 'medium' ? 'Use with real care' : 'Compatible, but keep portions honest',
      detail: notes.length ? notes.join(' ') : 'No specific concern for this condition at this serving size.',
    };
  }).filter(Boolean);

  // --- tags for alternative matching --------------------------------------
  const tags = [];
  if (components.sugar >= 50) tags.push('high_sugar');
  if (components.sodium >= 50) tags.push('high_sodium');
  if (components.satfat >= 50) tags.push('high_satfat');
  if (components.fat >= 60) tags.push('high_fat');
  if (components.processing >= 60) tags.push('ultra_processed');
  if (components.fiber >= 50) tags.push('low_fiber');
  if (components.energy >= 60) tags.push('high_calorie');

  const ingredientFlags = scanIngredientWords(ingredients);

  return {
    score,
    verdict,
    frequency,
    per100g: per100,
    perPortion: p,
    portionG,
    servingG,
    components: Object.fromEntries(Object.entries(components).map(([k, v]) => [k, Math.round(v)])),
    drivers,
    dailyAllowance,
    dailyPercent,
    consequences,
    positives,
    conditions: conditionReports,
    additives: additives.map((a) => publicAdditive(a.code)).filter(Boolean),
    ingredientFlags,
    tags,
    estimates: {
      teaspoonsSugarPerServing: tsp,
      sugarPerYearKg: round((p.sugar * 365) / 1000, 2),
      sodiumPerYearG: round((p.sodium * 365) / 1000, 1),
      weightGainPerYearKg: yearlyKg,
      energyFromSugarPct: per100.kcal > 0 ? Math.round(((per100.sugar * 4) / per100.kcal) * 100) : 0,
    },
  };
}

/** Lightweight score used for lists, pantry rows and alternative ranking. */
export function quickScore(nutrition, nova, additives = []) {
  const per100 = normalizeNutrition(nutrition);
  const list = resolveAdditives(additives);
  const components = {
    sugar: sugarScore(per100.sugar),
    sodium: sodiumScore(per100.sodium),
    satfat: satfatScore(per100.satfat),
    transFat: transFatScore(per100.transFat),
    energy: energyScore(per100.kcal),
    fiber: fiberScore(per100.fiber),
    additives: additiveRiskScore(list),
    processing: processingScore(nova),
  };
  let base = 0;
  for (const [k, w] of Object.entries(COMPONENT_WEIGHTS)) base += components[k] * w;
  if (per100.sugar >= 30) base = Math.max(base, 58);
  if (per100.sodium >= 1200) base = Math.max(base, 62);
  const score = Math.round(clamp(base));
  return { score, verdict: verdictFor(score) };
}
