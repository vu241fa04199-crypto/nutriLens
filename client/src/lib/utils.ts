import type { Nutrition, Tone } from './types';

export const cn = (...parts: (string | false | null | undefined)[]) => parts.filter(Boolean).join(' ');

export const clamp = (v: number, min = 0, max = 100) => Math.max(min, Math.min(max, v));

export const pct = (value: number, limit: number) => (limit > 0 ? Math.round((value / limit) * 100) : 0);

export const nf = (v: number | null | undefined, digits = 0) =>
  Number(v || 0).toLocaleString('en-IN', { maximumFractionDigits: digits, minimumFractionDigits: 0 });

export const todayKey = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export const shiftDate = (key: string, days: number) => {
  const d = new Date(`${key}T12:00:00`);
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export const prettyDate = (key: string) =>
  new Date(`${key}T12:00:00`).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });

export const relativeDay = (key: string) => {
  const today = todayKey();
  if (key === today) return 'Today';
  if (key === shiftDate(today, -1)) return 'Yesterday';
  if (key === shiftDate(today, 1)) return 'Tomorrow';
  return prettyDate(key);
};

export const timeAgo = (iso: string) => {
  const then = new Date(iso).getTime();
  const diff = Date.now() - then;
  const mins = Math.round(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
};

export const greeting = () => {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
};

// --- tone system -----------------------------------------------------------
export const TONE_CHIP: Record<Tone, string> = {
  emerald: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  lime: 'bg-lime-50 text-lime-700 ring-lime-200',
  amber: 'bg-amber-50 text-amber-700 ring-amber-200',
  orange: 'bg-orange-50 text-orange-700 ring-orange-200',
  red: 'bg-red-50 text-red-700 ring-red-200',
  slate: 'bg-ink-100 text-ink-600 ring-ink-200',
  sky: 'bg-sky-50 text-sky-700 ring-sky-200',
  violet: 'bg-violet-50 text-violet-700 ring-violet-200',
};

export const TONE_SOLID: Record<Tone, string> = {
  emerald: 'bg-emerald-500',
  lime: 'bg-lime-500',
  amber: 'bg-amber-500',
  orange: 'bg-orange-500',
  red: 'bg-red-500',
  slate: 'bg-ink-400',
  sky: 'bg-sky-500',
  violet: 'bg-violet-500',
};

export const TONE_TEXT: Record<Tone, string> = {
  emerald: 'text-emerald-600',
  lime: 'text-lime-600',
  amber: 'text-amber-600',
  orange: 'text-orange-600',
  red: 'text-red-600',
  slate: 'text-ink-500',
  sky: 'text-sky-600',
  violet: 'text-violet-600',
};

export const TONE_STROKE: Record<Tone, string> = {
  emerald: '#10b981',
  lime: '#84cc16',
  amber: '#f59e0b',
  orange: '#f97316',
  red: '#ef4444',
  slate: '#94a3b8',
  sky: '#0ea5e9',
  violet: '#8b5cf6',
};

export function toneForScore(score: number): Tone {
  if (score <= 19) return 'emerald';
  if (score <= 39) return 'lime';
  if (score <= 59) return 'amber';
  if (score <= 79) return 'orange';
  return 'red';
}

export function verdictLabel(score: number) {
  if (score <= 19) return 'Everyday friendly';
  if (score <= 39) return 'Okay in moderation';
  if (score <= 59) return 'Keep it occasional';
  if (score <= 79) return 'High risk';
  return 'Avoid as a habit';
}

export function severityTone(level: 'high' | 'medium' | 'low'): Tone {
  return level === 'high' ? 'red' : level === 'medium' ? 'amber' : 'emerald';
}

export const emptyNutrition = (): Nutrition => ({
  kcal: 0, protein: 0, carbs: 0, sugar: 0, addedSugar: 0, fiber: 0, fat: 0, satfat: 0, transFat: 0, sodium: 0,
});

export const MEALS = [
  { id: 'breakfast', label: 'Breakfast', icon: 'Sunrise', time: '6–11 am' },
  { id: 'lunch', label: 'Lunch', icon: 'Sun', time: '12–4 pm' },
  { id: 'snack', label: 'Snacks', icon: 'Cookie', time: 'anytime' },
  { id: 'dinner', label: 'Dinner', icon: 'Moon', time: '7–11 pm' },
] as const;

export const NOVA_OPTIONS = [
  { value: 1, label: '1 · Unprocessed / whole food', hint: 'e.g. oats, dal, eggs, fresh fruit, plain nuts' },
  { value: 2, label: '2 · Processed culinary ingredient', hint: 'e.g. butter, ghee, salt, sugar, oil' },
  { value: 3, label: '3 · Processed food', hint: 'e.g. canned beans, cheese, salted nuts, bread' },
  { value: 4, label: '4 · Ultra-processed', hint: 'e.g. chips, colas, instant noodles, biscuits' },
];

export const bmi = (weightKg?: number | null, heightCm?: number | null) => {
  if (!weightKg || !heightCm) return null;
  const m = heightCm / 100;
  return Math.round((weightKg / (m * m)) * 10) / 10;
};

export const bmiLabel = (value: number | null) => {
  if (value == null) return '';
  if (value < 18.5) return 'Underweight';
  if (value < 25) return 'Healthy range';
  if (value < 30) return 'Overweight';
  return 'Obese';
};

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Rough client-side score used only for optimistic UI before the server responds.
export function estimateScore(n: Partial<Nutrition> | undefined, nova = 4): number {
  if (!n) return 50;
  const num = (v: unknown) => (Number.isFinite(Number(v)) ? Number(v) : 0);
  const clampS = (v: number) => Math.max(0, Math.min(100, v));
  const sugar = clampS(num(n.sugar) <= 5 ? (num(n.sugar) / 5) * 15 : num(n.sugar) <= 22.5 ? 15 + ((num(n.sugar) - 5) / 17.5) * 45 : 60 + ((num(n.sugar) - 22.5) / 30) * 40);
  const sodium = clampS(num(n.sodium) <= 120 ? (num(n.sodium) / 120) * 15 : num(n.sodium) <= 600 ? 15 + ((num(n.sodium) - 120) / 480) * 45 : 60 + ((num(n.sodium) - 600) / 1400) * 40);
  const satfat = clampS(num(n.satfat) <= 1.5 ? (num(n.satfat) / 1.5) * 15 : num(n.satfat) <= 5 ? 15 + ((num(n.satfat) - 1.5) / 3.5) * 45 : 60 + ((num(n.satfat) - 5) / 15) * 40);
  const energy = clampS(num(n.kcal) <= 150 ? (num(n.kcal) / 150) * 10 : num(n.kcal) <= 400 ? 10 + ((num(n.kcal) - 150) / 250) * 55 : 65 + ((num(n.kcal) - 400) / 300) * 35);
  const fiber = clampS(num(n.fiber) >= 6 ? 0 : num(n.fiber) >= 3 ? 35 + ((6 - num(n.fiber)) / 3) * 20 : 55 + ((3 - num(n.fiber)) / 3) * 45);
  const processing = ({ 1: 0, 2: 15, 3: 45, 4: 85 } as Record<number, number>)[nova] ?? 45;
  const base = sugar * 0.22 + sodium * 0.17 + satfat * 0.12 + energy * 0.13 + fiber * 0.11 + processing * 0.08;
  return Math.round(clampS(num(n.sugar) >= 30 ? Math.max(base, 58) : base));
}
