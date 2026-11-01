export type Tone = 'emerald' | 'lime' | 'amber' | 'orange' | 'red' | 'slate' | 'sky' | 'violet';

export interface Nutrition {
  kcal: number;
  protein: number;
  carbs: number;
  sugar: number;
  addedSugar: number;
  fiber: number;
  fat: number;
  satfat: number;
  transFat: number;
  sodium: number;
}

export interface Verdict {
  max: number;
  key: 'everyday' | 'moderate' | 'caution' | 'high' | 'avoid';
  label: string;
  tone: Tone;
  blurb: string;
}

export interface User {
  id: number;
  name: string;
  email: string;
  age: number | null;
  sex: string | null;
  heightCm: number | null;
  weightKg: number | null;
  activity: string | null;
  conditions: string[];
  allergies: string[];
  role: 'admin' | 'user';
  emailVerified: boolean;
  provider: string;
  avatarUrl: string | null;
  lastLoginAt: string | null;
  createdAt: string;
  initials?: string;
}

export interface MailMessage {
  id: number;
  to: string;
  subject: string;
  body: string;
  link: string | null;
  kind: 'verify' | 'reset' | 'notice' | string;
  createdAt: string;
}

export interface AdminUser {
  id: number;
  name: string;
  email: string;
  role: 'admin' | 'user';
  emailVerified: boolean;
  provider: string;
  scans: number;
  logs: number;
  products: number;
  createdAt: string;
  lastLoginAt: string | null;
}

export interface AdminOverview {
  stats: {
    users: number;
    verified: number;
    admins: number;
    oauth: number;
    scans: number;
    logs: number;
    avgScore: number;
    verificationRate: number;
  };
  activity: { date: string; scans: number }[];
  topProducts: { name: string; count: number; avgScore: number }[];
  risky: { name: string; count: number; avgScore: number }[];
  recentUsers: AdminUser[];
}

export interface Product {
  id: number;
  name: string;
  brand: string;
  category: string;
  servingG: number;
  servingLabel: string;
  nutrition: Nutrition;
  ingredients: string;
  additives: string[];
  nova: number;
  emoji: string;
  notes: string;
  isCatalogue?: boolean;
  score: number;
  verdict: Verdict;
  createdAt?: string;
  updatedAt?: string;
}

export interface Additive {
  code: string;
  name: string;
  category: string;
  level: 'high' | 'medium' | 'low';
  what: string;
  why: string;
  found: string[];
}

export interface Consequence {
  id: string;
  title: string;
  severity: 'high' | 'medium' | 'low';
  horizon: string;
  detail: string;
  evidence: string;
}

export interface ConditionReport {
  id: string;
  label: string;
  severity: 'high' | 'medium' | 'low';
  headline: string;
  detail: string;
}

export interface Alternative {
  id: number;
  name: string;
  brand: string;
  category: string;
  description: string;
  swapReason: string;
  nutrition: Nutrition;
  nova: number;
  tags: string[];
  emoji: string;
  score: number;
  verdict: Verdict;
  deltas?: { kcal: number; sugar: number; sodium: number; satfat: number; fiber: number };
  improvement?: number;
  matchedTags?: string[];
}

export interface Analysis {
  score: number;
  verdict: Verdict;
  frequency: { text: string; detail: string };
  per100g: Nutrition;
  perPortion: Nutrition & { salt: number };
  portionG: number;
  servingG: number;
  components: Record<string, number>;
  drivers: { key: string; label: string; score: number; weight: number; impact: number }[];
  dailyAllowance: {
    grams: number;
    servings: number;
    servingG: number;
    limitingNutrient: string | null;
    limiting: { key: string; label: string; limit: number; unit: string; per100: number; gramsAllowed: number; isBinding: boolean }[];
    frequency: string;
    frequencyDetail: string;
    perServingPctSugar: number;
    perServingPctSodium: number;
    perServingPctSatfat: number;
    perServingPctEnergy: number;
  };
  dailyPercent: { key: string; label: string; unit: string; value: number; limit: number; percent: number; positive: boolean }[];
  consequences: Consequence[];
  positives: { label: string; key: string }[];
  conditions: ConditionReport[];
  additives: Additive[];
  ingredientFlags: { label: string; note: string; level: string }[];
  tags: string[];
  estimates: {
    teaspoonsSugarPerServing: number;
    sugarPerYearKg: number;
    sodiumPerYearG: number;
    weightGainPerYearKg: number;
    energyFromSugarPct: number;
  };
}

export interface Scan {
  id: number;
  productName: string;
  brand: string;
  category: string;
  portionG: number;
  servingG: number;
  nutrition: Nutrition;
  ingredients: string;
  additives: string[];
  nova: number;
  score: number;
  verdictKey: string;
  verdictLabel: string;
  notes: string;
  createdAt: string;
  result?: Analysis;
}

export interface IntakeEntry {
  id: number;
  date: string;
  meal: 'breakfast' | 'lunch' | 'dinner' | 'snack';
  name: string;
  productId: number | null;
  portionG: number;
  nutrition: Nutrition;
  score: number | null;
  createdAt: string;
}

export interface DayLog {
  date: string;
  entries: IntakeEntry[];
  totals: Nutrition;
  limits: Record<string, number>;
}

export interface CategoryMeta {
  id: string;
  label: string;
  emoji: string;
}

export interface ConditionMeta {
  id: string;
  label: string;
  icon: string;
  blurb: string;
}

export interface Meta {
  categories: CategoryMeta[];
  conditions: ConditionMeta[];
  limits: Record<string, number>;
  verdicts: Verdict[];
}

export interface DashboardData {
  stats: {
    scansTotal: number;
    scansThisWeek: number;
    avgScore: number | null;
    avgScoreThisWeek: number | null;
    trackedDays: number;
    loggedToday: number;
    worstScore: number | null;
    bestScore: number | null;
    sugarToday: number;
    sodiumToday: number;
    kcalToday: number;
    sugarPct: number;
    sodiumPct: number;
    kcalPct: number;
    fiberToday: number;
  };
  trend: { date: string; label: string; avgScore: number | null; count: number }[];
  weekSeries: ({ date: string; label: string; count: number } & Nutrition)[];
  buckets: Record<string, number>;
  offenders: Scan[];
  recentScans: Scan[];
  today: { date: string; entries: IntakeEntry[]; totals: Nutrition; limits: Record<string, number> };
  swap: { scan: { id: number; productName: string; score: number }; alternative: Alternative } | null;
  conditions: string[];
  limits: Record<string, number>;
}
