// Knowledge base of common food additives / ingredients of concern.
// level: 'high' | 'medium' | 'low'
// This powers the ingredient decoder on the Scan page and the Learn library.

export const ADDITIVES = [
  {
    code: '250',
    name: 'Sodium nitrite',
    category: 'Preservative',
    level: 'high',
    what: 'Cures and colours processed meat; stops botulism.',
    why: 'Can form nitrosamines (known carcinogens) when heated with meat proteins. Processed meat is IARC Group 1 (colorectal cancer). WHO advises minimising intake.',
    found: ['sausages', 'ham', 'salami', 'bacon', 'canned meat'],
  },
  {
    code: '251',
    name: 'Sodium nitrate',
    category: 'Preservative',
    level: 'high',
    what: 'Slow-release curing salt for meats and some cheeses.',
    why: 'Converts to nitrite in the body; same nitrosamine concern as E250.',
    found: ['cured meats', 'some cheeses'],
  },
  {
    code: '102',
    name: 'Tartrazine (Yellow 5)',
    category: 'Colour',
    level: 'high',
    what: 'Synthetic lemon-yellow dye used in drinks, chips and sweets.',
    why: 'One of the "Southampton six" colours linked to hyperactivity and attention problems in children. Banned or warning-labelled in parts of the EU.',
    found: ['soft drinks', 'instant noodles masala', 'sweets', 'pickles'],
  },
  {
    code: '110',
    name: 'Sunset Yellow FCF (Yellow 6)',
    category: 'Colour',
    level: 'high',
    what: 'Orange dye for snacks, jellies and beverages.',
    why: 'Southampton six colour — hyperactivity link; possible histamine-type reactions in sensitive people.',
    found: ['chips', 'jelly', 'juice drinks'],
  },
  {
    code: '122',
    name: 'Azorubine / Carmoisine',
    category: 'Colour',
    level: 'high',
    what: 'Red synthetic dye for sweets and desserts.',
    why: 'Southampton six colour; hyperactivity in children, banned in USA and Japan.',
    found: ['sweets', 'jelly', 'desserts'],
  },
  {
    code: '124',
    name: 'Ponceau 4R',
    category: 'Colour',
    level: 'high',
    what: 'Red dye common in Indian sweets, sauces and masalas.',
    why: 'Southampton six colour; hyperactivity link, restricted in the US and EU.',
    found: ['sweets', 'sauces', 'masala mixes'],
  },
  {
    code: '129',
    name: 'Allura Red (Red 40)',
    category: 'Colour',
    level: 'high',
    what: 'The most widely used red dye in packaged snacks and drinks.',
    why: 'Southampton six colour linked to hyperactivity. Also under study for effects on gut inflammation.',
    found: ['snacks', 'cereals', 'beverages', 'candy'],
  },
  {
    code: '150c',
    name: 'Caramel colour (Class III)',
    category: 'Colour',
    level: 'medium',
    what: 'Brown colour made by heating sugars with ammonia.',
    why: 'Contains 4-MEI, a compound that caused tumours in animal studies. Cola drinks are the biggest source.',
    found: ['cola', 'sauces', 'biscuits'],
  },
  {
    code: '150d',
    name: 'Caramel colour (Class IV)',
    category: 'Colour',
    level: 'medium',
    what: 'Sulphite-ammonia caramel used in noodles, gravies and sauces.',
    why: 'Same 4-MEI concern as Class III. California requires a warning label above 29 µg/day.',
    found: ['noodles', 'soy sauce', 'gravies'],
  },
  {
    code: '211',
    name: 'Sodium benzoate',
    category: 'Preservative',
    level: 'medium',
    what: 'Keeps soft drinks, sauces and jams from spoiling.',
    why: 'With vitamin C (or heat/light) it can form benzene, a carcinogen. Also linked to hyperactivity in children.',
    found: ['soft drinks', 'sauces', 'jams'],
  },
  {
    code: '202',
    name: 'Potassium sorbate',
    category: 'Preservative',
    level: 'low',
    what: 'Mould inhibitor in drinks, cheese and bakery.',
    why: 'Generally well tolerated; occasional skin irritation. Low risk at food levels.',
    found: ['drinks', 'cheese', 'bakery'],
  },
  {
    code: '220',
    name: 'Sulphur dioxide / sulphites',
    category: 'Preservative',
    level: 'medium',
    what: 'Preserves dried fruit, wine and some juices.',
    why: 'Triggers asthma attacks and wheezing in sensitive people; destroys vitamin B1.',
    found: ['dried fruit', 'juices', 'wine'],
  },
  {
    code: '319',
    name: 'TBHQ',
    category: 'Antioxidant',
    level: 'high',
    what: 'Keeps frying oil and instant noodles from going rancid.',
    why: 'Animal studies at high doses show stomach and DNA effects; the oil it protects is often repeatedly reheated. Best avoided in daily foods.',
    found: ['instant noodles', 'fried snacks', 'cooking oils'],
  },
  {
    code: '320',
    name: 'BHA',
    category: 'Antioxidant',
    level: 'high',
    what: 'Synthetic antioxidant in fats, chips and cereals.',
    why: 'Classified "reasonably anticipated to be a human carcinogen" by the US NTP; possible endocrine disruption.',
    found: ['chips', 'cereals', 'chewing gum fat'],
  },
  {
    code: '321',
    name: 'BHT',
    category: 'Antioxidant',
    level: 'medium',
    what: 'Antioxidant that keeps fats from turning rancid.',
    why: 'Mixed evidence for liver and thyroid effects in animals; suspected hormone disruptor.',
    found: ['chips', 'instant mixes', 'bakery fats'],
  },
  {
    code: '621',
    name: 'Monosodium glutamate (MSG)',
    category: 'Flavour enhancer',
    level: 'medium',
    what: 'Umami booster that makes salty snacks hard to stop eating.',
    why: 'Not toxic, but it drives overeating of ultra-processed food; some people get headaches, flushing and palpitations ("MSG symptom complex").',
    found: ['noodles', 'chips', 'namkeen', 'soups', 'restaurant food'],
  },
  {
    code: '627',
    name: 'Disodium guanylate',
    category: 'Flavour enhancer',
    level: 'medium',
    what: 'Works with MSG to amplify savoury taste.',
    why: 'Almost always signals a heavily engineered, hyper-palatable product. Avoid with gout (purine load).',
    found: ['noodles', 'chips', 'soups', 'seasoning'],
  },
  {
    code: '631',
    name: 'Disodium inosinate',
    category: 'Flavour enhancer',
    level: 'medium',
    what: 'Savoury booster, usually paired with E627.',
    why: 'Marker of ultra-processing; purine source — caution in gout.',
    found: ['noodles', 'chips', 'soups'],
  },
  {
    code: '635',
    name: 'Disodium ribonucleotides',
    category: 'Flavour enhancer',
    level: 'medium',
    what: 'Blend of E627 + E631 used in instant noodles and chips.',
    why: 'Purine-rich; can trigger gout flares. Strong marker of an engineered, addictive taste profile.',
    found: ['instant noodles', 'chips', 'seasoning'],
  },
  {
    code: '951',
    name: 'Aspartame',
    category: 'Sweetener',
    level: 'medium',
    what: 'Artificial sweetener in "zero sugar" drinks and gum.',
    why: 'Classified IARC Group 2B (possibly carcinogenic) in 2023. Safe under 40 mg/kg/day, but daily diet-drink habits exceed this for some people.',
    found: ['diet drinks', 'sugar-free gum', 'desserts'],
  },
  {
    code: '950',
    name: 'Acesulfame K',
    category: 'Sweetener',
    level: 'medium',
    what: 'Heat-stable artificial sweetener, usually blended with aspartame.',
    why: 'Animal studies raise questions about gut microbiome and glucose handling; long-term human data is thin.',
    found: ['diet drinks', 'baked goods', 'candy'],
  },
  {
    code: '955',
    name: 'Sucralose',
    category: 'Sweetener',
    level: 'medium',
    what: '600× sweeter than sugar; sold as Splenda.',
    why: 'Emerging evidence it alters gut bacteria and may impair insulin sensitivity; heating it can form chlorinated compounds.',
    found: ['diet drinks', 'protein powders', 'baked goods'],
  },
  {
    code: '407',
    name: 'Carrageenan',
    category: 'Thickener',
    level: 'medium',
    what: 'Seaweed extract that thickens milk drinks and desserts.',
    why: 'Linked in studies to gut inflammation and intestinal irritation; animal studies show colitis-like damage.',
    found: ['flavoured milk', 'ice cream', 'dairy alternatives'],
  },
  {
    code: '322',
    name: 'Soy lecithin',
    category: 'Emulsifier',
    level: 'low',
    what: 'Keeps chocolate smooth and stops fat separating.',
    why: 'Generally safe; usually non-GMO soy. Only a concern for severe soy allergy.',
    found: ['chocolate', 'biscuits', 'bakery'],
  },
  {
    code: '471',
    name: 'Mono- and diglycerides of fatty acids',
    category: 'Emulsifier',
    level: 'medium',
    what: 'Emulsifier in bakery, spreads and ice cream.',
    why: 'Industrial emulsifiers are being studied for effects on the gut barrier and microbiome; often accompanies trans fat.',
    found: ['bread', 'ice cream', 'cakes'],
  },
  {
    code: '476',
    name: 'Polyglycerol polyricinoleate',
    category: 'Emulsifier',
    level: 'low',
    what: 'Makes chocolate flow easily in moulds.',
    why: 'Low toxicity at food levels; a marker of highly processed chocolate.',
    found: ['chocolate'],
  },
  {
    code: '338',
    name: 'Phosphoric acid',
    category: 'Acidity regulator',
    level: 'medium',
    what: 'Gives cola its sharp tang.',
    why: 'High cola intake is linked to lower bone density and kidney stone risk; a problem for people with kidney disease.',
    found: ['cola', 'energy drinks'],
  },
  {
    code: '330',
    name: 'Citric acid',
    category: 'Acidity regulator',
    level: 'low',
    what: 'Acidity and tartness in drinks, noodles and candy.',
    why: 'Safe at food levels; in very high amounts it can soften tooth enamel.',
    found: ['drinks', 'noodles', 'candy'],
  },
  {
    code: '500',
    name: 'Sodium bicarbonate',
    category: 'Raising agent',
    level: 'low',
    what: 'Baking soda — makes biscuits and cakes rise.',
    why: 'Harmless in normal amounts, but it does add to your total sodium load.',
    found: ['biscuits', 'cakes', 'crackers'],
  },
  {
    code: '503',
    name: 'Ammonium bicarbonate',
    category: 'Raising agent',
    level: 'low',
    what: 'Traditional leavening for biscuits and papad.',
    why: 'Low risk at food levels.',
    found: ['biscuits', 'papad', 'crackers'],
  },
  {
    code: '282',
    name: 'Calcium propionate',
    category: 'Preservative',
    level: 'low',
    what: 'Mould inhibitor in bread.',
    why: 'Considered safe; some small studies suggest behavioural effects in children.',
    found: ['bread', 'bakery'],
  },
  {
    code: 'HYDROGENATED',
    name: 'Hydrogenated / partially hydrogenated fat',
    category: 'Fat',
    level: 'high',
    what: 'Cheap fat that keeps fried snacks crisp and shelf-stable.',
    why: 'The main dietary source of industrial trans fat — raises LDL, lowers HDL and inflames blood vessels. WHO wants it eliminated from the food supply.',
    found: ['bakery', 'vanaspati', 'fried snacks', 'creams'],
  },
  {
    code: 'HFCS',
    name: 'High-fructose corn syrup / invert syrup',
    category: 'Sugar',
    level: 'high',
    what: 'Liquid sugar cheaper and sweeter than cane sugar.',
    why: 'Fructose is metabolised in the liver — a driver of fatty liver, insulin resistance and visceral fat when consumed daily.',
    found: ['soft drinks', 'sauces', 'biscuits', 'candy'],
  },
  {
    code: 'MALTODEXTRIN',
    name: 'Maltodextrin',
    category: 'Sugar / bulking agent',
    level: 'medium',
    what: 'Highly refined starch with a higher glycaemic index than table sugar.',
    why: 'Spikes blood glucose fast and feeds less-healthy gut bacteria — a hidden sugar for diabetics.',
    found: ['flavoured snacks', 'protein powders', 'sauces'],
  },
  {
    code: 'PALMOIL',
    name: 'Refined palm oil',
    category: 'Fat',
    level: 'medium',
    what: 'Cheap frying fat in noodles, biscuits and namkeen.',
    why: 'Around 45% saturated fat; repeatedly reheated frying oil generates aldehydes that stress the heart and liver.',
    found: ['noodles', 'biscuits', 'namkeen', 'chips'],
  },
  {
    code: 'ARTIFICIAL_FLAVOUR',
    name: 'Artificial flavour',
    category: 'Flavour',
    level: 'medium',
    what: 'Synthetic aroma compounds that make a product hyper-palatable.',
    why: 'Individual compounds are approved, but the combination is designed to override satiety — the core of ultra-processed food addiction.',
    found: ['chips', 'drinks', 'candy', 'biscuits'],
  },
  {
    code: 'CARAMEL_SYRUPS',
    name: 'Glucose / liquid glucose syrup',
    category: 'Sugar',
    level: 'medium',
    what: 'Cheap sugar syrup for texture and sweetness.',
    why: 'Pure refined sugar with no nutrients; adds to daily free-sugar load beyond what the label front shows.',
    found: ['candy', 'biscuits', 'sweets'],
  },
];

// Regex matchers -> additive code. Applied to ingredient list text.
const MATCHERS = [
  [/\b(250|sodium nitrite)\b/i, '250'],
  [/\b(251|sodium nitrate|potassium nitrate|525)\b/i, '251'],
  [/\b(102|tartrazine|yellow\s*5)\b/i, '102'],
  [/\b(110|sunset yellow|yellow\s*6)\b/i, '110'],
  [/\b(122|azorubine|carmoisine)\b/i, '122'],
  [/\b(124|ponceau)\b/i, '124'],
  [/\b(129|allura red|red\s*40)\b/i, '129'],
  [/\b(150\s*c|class\s*(iii|3)\s*caramel)\b/i, '150c'],
  [/\b(150\s*d|class\s*(iv|4)\s*caramel|caramel colou?r)\b/i, '150d'],
  [/\b(211|sodium benzoate)\b/i, '211'],
  [/\b(202|potassium sorbate|sorbic acid)\b/i, '202'],
  [/\b(220|221|223|224|sulphite|sulfite|sulphur dioxide)\b/i, '220'],
  [/\b(tbhq|319|tertiary butylhydroquinone)\b/i, '319'],
  [/\b(bha|320|butylated hydroxyanisole)\b/i, '320'],
  [/\b(bht|321|butylated hydroxytoluene)\b/i, '321'],
  [/\b(621|msg|monosodium glutamate|flavour enhancer)\b/i, '621'],
  [/\b(627|disodium guanylate)\b/i, '627'],
  [/\b(631|disodium inosinate)\b/i, '631'],
  [/\b(635|disodium ribonucleotide)\b/i, '635'],
  [/\b(951|aspartame)\b/i, '951'],
  [/\b(950|acesulfame)\b/i, '950'],
  [/\b(955|sucralose)\b/i, '955'],
  [/\b(407|carrageenan)\b/i, '407'],
  [/\b(322|lecithin)\b/i, '322'],
  [/\b(471|mono-?\s*and\s*di-?glycerides)\b/i, '471'],
  [/\b(476|polyglycerol)\b/i, '476'],
  [/\b(338|phosphoric acid)\b/i, '338'],
  [/\b(330|citric acid)\b/i, '330'],
  [/\b(500|sodium bicarbonate|baking soda)\b/i, '500'],
  [/\b(503|ammonium bicarbonate)\b/i, '503'],
  [/\b(282|calcium propionate)\b/i, '282'],
  [/\b(hydrogenated|vanaspati|shortening|margarine)\b/i, 'HYDROGENATED'],
  [/\b(high fructose corn syrup|invert (sugar )?syrup|fructose syrup|h(igh)?fcs)\b/i, 'HFCS'],
  [/\b(maltodextrin)\b/i, 'MALTODEXTRIN'],
  [/\b(palm oil|palmolein|palm fat)\b/i, 'PALMOIL'],
  [/\b(artificial flavour|artificial flavor|nature identical flavour)\b/i, 'ARTIFICIAL_FLAVOUR'],
  [/\b(liquid glucose|glucose syrup|corn syrup)\b/i, 'CARAMEL_SYRUPS'],
];

const BY_CODE = new Map(ADDITIVES.map((a) => [a.code, a]));

export function additiveByCode(code) {
  return BY_CODE.get(String(code));
}

export function publicAdditive(code) {
  const a = additiveByCode(code);
  if (!a) return null;
  return {
    code: a.code,
    name: a.name,
    category: a.category,
    level: a.level,
    what: a.what,
    why: a.why,
    found: a.found,
  };
}

/** Find additive codes mentioned in a free-text ingredient list. */
export function parseIngredientAdditives(text = '') {
  const found = new Set();
  for (const [re, code] of MATCHERS) {
    if (re.test(text)) found.add(code);
  }
  return [...found];
}

/** Resolve codes to additive records (dedupes, keeps only known ones). */
export function resolveAdditives(codes = []) {
  const seen = new Set();
  const out = [];
  for (const c of codes) {
    const key = String(c).trim().toUpperCase();
    const a = additiveByCode(key) || additiveByCode(c);
    if (a && !seen.has(a.code)) {
      seen.add(a.code);
      out.push(a);
    }
  }
  return out;
}

/**
 * Pull a structured list of "ingredients that matter" (sugar hiding, fats)
 * out of the ingredient text, even when there is no E-number.
 */
export function scanIngredientWords(text = '') {
  const t = text.toLowerCase();
  const hits = [];
  const add = (label, note, level) => hits.push({ label, note, level });
  if (/(sugar|sucrose|glucose|dextrose|fructose|syrup|jaggery|honey|maltose)/.test(t))
    add('Added sugar', 'Sugar appears in one or more forms — ingredient lists are ordered by weight, so its position matters.', 'medium');
  if (/refined|maida|white flour/.test(t))
    add('Refined flour (maida)', 'Stripped of bran and germ — fast-digesting starch with almost no fibre.', 'medium');
  if (/palm|vanaspati|shortening|hydrogenated/.test(t))
    add('Industrial fat', 'Cheap saturated/trans fat blend used for frying and mouthfeel.', 'high');
  if (/salt|sodium/.test(t)) add('Added salt', 'Salt usually appears more than once on the list (as salt, seasoning, flavour enhancer) — the sodium adds up.', 'medium');
  if (/artificial|flavour|flavor|colour|color/.test(t))
    add('Flavour/colour system', 'A engineered taste and appearance profile that makes the food hard to stop eating.', 'medium');
  if (/preservative/.test(t)) add('Preservatives', 'Extends shelf life; benzoates and nitrites deserve a closer look.', 'medium');
  return hits;
}
