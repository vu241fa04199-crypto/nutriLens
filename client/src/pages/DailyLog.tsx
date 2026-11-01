import { useEffect, useMemo, useState } from 'react';
import {
  CalendarDays, ChevronLeft, ChevronRight, ClipboardList, Cookie, Flame, Loader2, Moon, Pencil, Plus,
  Search, Sun, Sunrise, Trash2, TriangleAlert, Utensils,
} from 'lucide-react';
import { api } from '../lib/api';
import { useToast } from '../context/ToastContext';
import type { DayLog, IntakeEntry, Nutrition, Product } from '../lib/types';
import {
  Button, Card, CardHeader, Chip, EmptyState, Field, Input, Modal, NumberField, Select, Skeleton, Progress,
} from '../components/ui';
import { NutrientBars, WeekSugarChart } from '../components/charts';
import { cn, nf, pct, prettyDate, relativeDay, shiftDate, todayKey, toneForScore } from '../lib/utils';

const MEAL_META = [
  { id: 'breakfast', label: 'Breakfast', icon: Sunrise, hint: '6–11 am' },
  { id: 'lunch', label: 'Lunch', icon: Sun, hint: '12–4 pm' },
  { id: 'snack', label: 'Snacks', icon: Cookie, hint: 'anytime' },
  { id: 'dinner', label: 'Dinner', icon: Moon, hint: '7–11 pm' },
] as const;

const EMPTY_TOTALS: Nutrition = { kcal: 0, protein: 0, carbs: 0, sugar: 0, addedSugar: 0, fiber: 0, fat: 0, satfat: 0, transFat: 0, sodium: 0 };

function computeTotals(entries: IntakeEntry[]): Nutrition {
  const totals = { ...EMPTY_TOTALS };
  for (const e of entries) {
    for (const k of Object.keys(totals) as (keyof Nutrition)[]) {
      totals[k] += Number((e.nutrition as any)?.[k]) || 0;
    }
  }
  for (const k of Object.keys(totals) as (keyof Nutrition)[]) totals[k] = Math.round(totals[k] * 10) / 10;
  totals.sodium = Math.round(totals.sodium);
  totals.kcal = Math.round(totals.kcal);
  return totals;
}

const scale = (per100: Nutrition, portionG: number): Nutrition => {
  const f = portionG / 100;
  const out = { ...EMPTY_TOTALS };
  for (const k of Object.keys(out) as (keyof Nutrition)[]) {
    out[k] = k === 'sodium' ? Math.round(per100[k] * f) : Math.round(per100[k] * f * 10) / 10;
  }
  return out;
};

export default function DailyLog() {
  const toast = useToast();
  const [date, setDate] = useState(todayKey());
  const [day, setDay] = useState<DayLog | null>(null);
  const [loading, setLoading] = useState(true);
  const [week, setWeek] = useState<any[]>([]);
  const [pantry, setPantry] = useState<Product[]>([]);
  const [addOpen, setAddOpen] = useState(false);
  const [editing, setEditing] = useState<IntakeEntry | null>(null);
  const [deleting, setDeleting] = useState<IntakeEntry | null>(null);
  const [busy, setBusy] = useState(false);

  // add form
  const [mode, setMode] = useState<'pantry' | 'custom'>('pantry');
  const [productId, setProductId] = useState<number | null>(null);
  const [portionG, setPortionG] = useState(30);
  const [meal, setMeal] = useState<'breakfast' | 'lunch' | 'dinner' | 'snack'>('snack');
  const [customName, setCustomName] = useState('');
  const [custom, setCustom] = useState({ kcal: 0, sugar: 0, sodium: 0, satfat: 0, fat: 0, carbs: 0, fiber: 0, protein: 0 });
  const [search, setSearch] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  const load = async (key: string) => {
    setLoading(true);
    try {
      const res = await api.logs.day(key);
      setDay(res);
    } catch (e: any) {
      toast.error('Could not load that day', e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load(date);
    api.logs.week(date).then((r) => setWeek(r.days)).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date]);

  useEffect(() => {
    api.products.list().then((r) => setPantry(r.items)).catch(() => {});
  }, []);

  const entries = day?.entries || [];
  const totals = useMemo(() => computeTotals(entries), [entries]);
  const limits = day?.limits || { kcal: 2000, sugar: 50, sodium: 2000, satfat: 20, fiber: 30, protein: 55 };
  const isToday = date === todayKey();

  const selectedProduct = pantry.find((p) => p.id === productId) || null;
  const filteredPantry = useMemo(() => {
    if (!search.trim()) return pantry;
    const q = search.toLowerCase();
    return pantry.filter((p) => `${p.name} ${p.brand}`.toLowerCase().includes(q));
  }, [pantry, search]);

  const resetForm = () => {
    setMode(pantry.length ? 'pantry' : 'custom');
    setProductId(null);
    setPortionG(30);
    setMeal('snack');
    setCustomName('');
    setCustom({ kcal: 0, sugar: 0, sodium: 0, satfat: 0, fat: 0, carbs: 0, fiber: 0, protein: 0 });
    setSearch('');
    setFormError(null);
  };

  const openAdd = (presetMeal?: typeof meal) => {
    resetForm();
    if (presetMeal) setMeal(presetMeal);
    setAddOpen(true);
  };

  const addEntry = async () => {
    setFormError(null);
    setBusy(true);
    try {
      if (mode === 'pantry') {
        if (!selectedProduct) {
          setFormError('Pick a product from your pantry.');
          setBusy(false);
          return;
        }
        const tempId = -Date.now();
        const optimistic: IntakeEntry = {
          id: tempId,
          date,
          meal,
          name: selectedProduct.name,
          productId: selectedProduct.id,
          portionG,
          nutrition: scale(selectedProduct.nutrition, portionG),
          score: selectedProduct.score,
          createdAt: new Date().toISOString(),
        };
        setDay((d) => (d ? { ...d, entries: [...d.entries, optimistic] } : d));
        setAddOpen(false);
        try {
          const res = await api.logs.create({ date, meal, productId: selectedProduct.id, portionG });
          setDay((d) => (d ? { ...d, entries: d.entries.map((e) => (e.id === tempId ? res.item : e)) } : d));
          toast.success('Added to your log', `${selectedProduct.name} · ${portionG} g`);
        } catch (e: any) {
          setDay((d) => (d ? { ...d, entries: d.entries.filter((en) => en.id !== tempId) } : d));
          toast.error('Could not add that entry', e.message);
        }
      } else {
        if (customName.trim().length < 2) {
          setFormError('Give the food a name.');
          setBusy(false);
          return;
        }
        const per100: Nutrition = {
          kcal: custom.kcal, sugar: custom.sugar, addedSugar: custom.sugar, sodium: custom.sodium, satfat: custom.satfat,
          fat: custom.fat, carbs: custom.carbs, fiber: custom.fiber, protein: custom.protein, transFat: 0,
        };
        const tempId = -Date.now();
        const optimistic: IntakeEntry = {
          id: tempId, date, meal, name: customName.trim(), productId: null, portionG,
          nutrition: scale(per100, portionG), score: null, createdAt: new Date().toISOString(),
        };
        setDay((d) => (d ? { ...d, entries: [...d.entries, optimistic] } : d));
        setAddOpen(false);
        try {
          const res = await api.logs.create({ date, meal, name: customName.trim(), portionG, nutrition: per100 });
          setDay((d) => (d ? { ...d, entries: d.entries.map((e) => (e.id === tempId ? res.item : e)) } : d));
          toast.success('Added to your log', `${customName.trim()} · ${portionG} g`);
        } catch (e: any) {
          setDay((d) => (d ? { ...d, entries: d.entries.filter((en) => en.id !== tempId) } : d));
          toast.error('Could not add that entry', e.message);
        }
      }
    } finally {
      setBusy(false);
    }
  };

  const saveEdit = async (patch: { portionG?: number; meal?: typeof meal; name?: string }) => {
    if (!editing || !day) return;
    const previous = day.entries;
    const updated = previous.map((e) => {
      if (e.id !== editing.id) return e;
      const factor = (patch.portionG || e.portionG) / e.portionG;
      const nutrition = { ...EMPTY_TOTALS };
      for (const k of Object.keys(nutrition) as (keyof Nutrition)[]) {
        nutrition[k] = k === 'sodium' ? Math.round((e.nutrition[k] || 0) * factor) : Math.round((e.nutrition[k] || 0) * factor * 10) / 10;
      }
      return { ...e, ...patch, portionG: patch.portionG || e.portionG, nutrition };
    });
    setDay({ ...day, entries: updated });
    setEditing(null);
    try {
      const res = await api.logs.update(editing.id, patch);
      setDay((d) => (d ? { ...d, entries: d.entries.map((e) => (e.id === res.item.id ? res.item : e)) } : d));
      toast.success('Entry updated');
    } catch (e: any) {
      setDay((d) => (d ? { ...d, entries: previous } : d));
      toast.error('Update failed', e.message);
    }
  };

  const confirmDelete = async () => {
    if (!deleting || !day) return;
    const previous = day.entries;
    setDay({ ...day, entries: previous.filter((e) => e.id !== deleting.id) });
    const name = deleting.name;
    setDeleting(null);
    try {
      await api.logs.remove(deleting.id);
      toast.success('Removed from log', name);
    } catch (e: any) {
      setDay((d) => (d ? { ...d, entries: previous } : d));
      toast.error('Could not remove entry', e.message);
    }
  };

  return (
    <div className="space-y-5">
      {/* header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-[26px] font-bold tracking-tight text-ink-900 sm:text-[30px]">Daily log</h1>
          <p className="mt-1 max-w-xl text-[13.5px] leading-relaxed text-ink-500">
            Every serving spends part of your daily sugar, sodium and saturated-fat budget. Watch the budget, not just the calories.
          </p>
        </div>
        <Button icon={Plus} onClick={() => openAdd()}>
          Add food
        </Button>
      </div>

      {/* date bar */}
      <Card className="flex flex-wrap items-center gap-2 p-2.5">
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" onClick={() => setDate(shiftDate(date, -1))} aria-label="Previous day">
            <ChevronLeft size={16} />
          </Button>
          <div className="px-2 text-center">
            <p className="text-[13.5px] font-semibold text-ink-900">{relativeDay(date)}</p>
            <p className="text-[11px] text-ink-400">{prettyDate(date)}</p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setDate(shiftDate(date, 1))}
            disabled={date >= todayKey()}
            aria-label="Next day"
          >
            <ChevronRight size={16} />
          </Button>
        </div>
        {!isToday && (
          <Button variant="secondary" size="sm" icon={CalendarDays} onClick={() => setDate(todayKey())}>
            Jump to today
          </Button>
        )}
        <div className="ml-auto flex items-center gap-2">
          <Chip tone={totals.kcal > limits.kcal ? 'red' : 'slate'} icon={Flame}>
            {nf(totals.kcal)} / {nf(limits.kcal)} kcal
          </Chip>
          <Chip tone={totals.sugar > limits.sugar ? 'red' : totals.sugar > limits.sugar * 0.75 ? 'amber' : 'emerald'}>
            sugar {nf(totals.sugar, 1)} g
          </Chip>
        </div>
      </Card>

      {loading ? (
        <div className="grid grid-cols-1 grid gap-4 lg:grid-cols-3">
          <div className="space-y-4 lg:col-span-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <Card key={i} className="card-pad space-y-3">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
              </Card>
            ))}
          </div>
          <Card className="card-pad space-y-3">
            <Skeleton className="h-4 w-32" />
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-3 w-full" />
            ))}
          </Card>
        </div>
      ) : (
        <div className="grid grid-cols-1 grid gap-4 lg:grid-cols-3">
          {/* meals */}
          <div className="space-y-4 lg:col-span-2">
            {MEAL_META.map((m) => {
              const mealEntries = entries.filter((e) => e.meal === m.id);
              const mealKcal = mealEntries.reduce((a, e) => a + (e.nutrition.kcal || 0), 0);
              return (
                <Card key={m.id}>
                  <div className="flex items-center justify-between gap-2 border-b border-ink-100 px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-ink-50 text-ink-500">
                        <m.icon size={15} />
                      </span>
                      <div>
                        <p className="text-[13.5px] font-semibold text-ink-900">{m.label}</p>
                        <p className="text-[11px] text-ink-400">
                          {mealEntries.length ? `${mealEntries.length} item${mealEntries.length > 1 ? 's' : ''} · ${nf(mealKcal)} kcal` : m.hint}
                        </p>
                      </div>
                    </div>
                    <Button variant="ghost" size="sm" icon={Plus} onClick={() => openAdd(m.id)}>
                      Add
                    </Button>
                  </div>

                  {mealEntries.length === 0 ? (
                    <div className="flex items-center justify-between gap-3 px-4 py-3.5">
                      <p className="text-[12.5px] text-ink-400">Nothing logged for {m.label.toLowerCase()}.</p>
                      <button onClick={() => openAdd(m.id)} className="text-[12px] font-semibold text-brand-700 hover:text-brand-800">
                        Add something
                      </button>
                    </div>
                  ) : (
                    <ul className="divide-y divide-ink-100">
                      {mealEntries.map((e) => (
                        <li key={e.id} className={cn('group flex items-center gap-3 px-4 py-2.5', e.id < 0 && 'opacity-60')}>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <p className="truncate text-[13px] font-medium text-ink-900">{e.name}</p>
                              {e.score != null && <Chip tone={toneForScore(e.score)} className="shrink-0 py-0 text-[10px]">{e.score}</Chip>}
                            </div>
                            <p className="mt-0.5 text-[11.5px] text-ink-400">
                              {e.portionG} g · {nf(e.nutrition.kcal)} kcal · sugar {nf(e.nutrition.sugar, 1)} g · sodium {nf(e.nutrition.sodium)} mg
                            </p>
                          </div>
                          <div className="flex shrink-0 items-center gap-0.5 opacity-100 transition focus-within:opacity-100 sm:opacity-0 sm:group-hover:opacity-100">
                            <button
                              onClick={() => setEditing(e)}
                              className="rounded-lg p-1.5 text-ink-400 transition hover:bg-ink-100 hover:text-ink-700"
                              aria-label="Edit entry"
                            >
                              <Pencil size={13} />
                            </button>
                            <button
                              onClick={() => setDeleting(e)}
                              className="rounded-lg p-1.5 text-ink-400 transition hover:bg-red-50 hover:text-red-600"
                              aria-label="Delete entry"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </Card>
              );
            })}

            {entries.length === 0 && (
              <Card>
                <EmptyState
                  icon={ClipboardList}
                  title={`Nothing logged for ${relativeDay(date).toLowerCase()}`}
                  description="Add what you ate — from your pantry or as a custom item. The budget bars fill up as you go."
                  action={<Button icon={Plus} onClick={() => openAdd()}>Log your first item</Button>}
                />
              </Card>
            )}
          </div>

          {/* summary */}
          <div className="space-y-4">
            <Card>
              <CardHeader title="Today's budget" subtitle="How much of each cap you've spent" icon={Utensils} />
              <div className="card-pad">
                <div className="mb-4 flex items-end justify-between">
                  <div>
                    <p className="font-display text-[28px] font-bold leading-none tabular-nums text-ink-900">{nf(totals.kcal)}</p>
                    <p className="mt-1 text-[11.5px] text-ink-400">of {nf(limits.kcal)} kcal</p>
                  </div>
                  <Chip tone={totals.kcal > limits.kcal ? 'red' : totals.kcal > limits.kcal * 0.85 ? 'amber' : 'emerald'}>
                    {pct(totals.kcal, limits.kcal)}% used
                  </Chip>
                </div>
                <Progress value={totals.kcal} max={limits.kcal} className="mb-5" />
                <NutrientBars
                  compact
                  items={[
                    { label: 'Free sugar', value: totals.sugar, limit: limits.sugar, unit: 'g' },
                    { label: 'Sodium', value: totals.sodium, limit: limits.sodium, unit: 'mg' },
                    { label: 'Saturated fat', value: totals.satfat, limit: limits.satfat, unit: 'g' },
                    { label: 'Fibre', value: totals.fiber, limit: limits.fiber, unit: 'g', positive: true },
                    { label: 'Protein', value: totals.protein, limit: limits.protein, unit: 'g', positive: true },
                  ]}
                />
              </div>
            </Card>

            <Card>
              <CardHeader title="Last 7 days" subtitle="Sugar against the 50 g cap" icon={Flame} />
              <div className="px-3 pb-4 pt-2">
                {week.length ? (
                  week.some((d) => (d.totals?.sugar || 0) > 0) ? (
                    <WeekSugarChart data={week.map((d) => ({ label: d.label, sugar: d.totals?.sugar || 0 }))} limit={limits.sugar} />
                  ) : (
                    <EmptyState compact icon={Flame} title="Nothing logged this week" description="Your seven-day sugar picture appears here." />
                  )
                ) : (
                  <div className="flex h-[170px] items-center justify-center">
                    <Loader2 size={16} className="animate-spin text-ink-300" />
                  </div>
                )}
              </div>
            </Card>

            <Card className="bg-gradient-to-br from-brand-50 to-lime-50 p-4 ring-1 ring-inset ring-brand-100">
              <p className="text-[12px] font-semibold text-brand-900">Reading your day</p>
              <ul className="mt-2 space-y-1.5 text-[12px] leading-relaxed text-brand-800/80">
                <li>
                  · Sugar is at <strong>{pct(totals.sugar, limits.sugar)}%</strong> of the cap
                  {totals.sugar > limits.sugar
                    ? ' — already over the 50 g limit.'
                    : totals.sugar > limits.sugar * 0.9
                      ? ' — almost no room left today.'
                      : totals.sugar > limits.sugar * 0.6
                        ? ' — getting close to the limit.'
                        : ' — you have room.'}
                </li>
                <li>
                  · Sodium is at <strong>{pct(totals.sodium, limits.sodium)}%</strong>
                  {totals.sodium > limits.sodium ? ' — over the 2,000 mg limit.' : '.'}
                </li>
                <li>
                  · Fibre is at <strong>{pct(totals.fiber, limits.fiber)}%</strong> of the 30 g target
                  {totals.fiber < 15 ? ' — add dal, fruit or oats.' : ' — good going.'}
                </li>
              </ul>
            </Card>
          </div>
        </div>
      )}

      {/* add modal */}
      <Modal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        title="Add food to your log"
        description={`Logging for ${relativeDay(date).toLowerCase()} · ${prettyDate(date)}`}
        footer={
          <>
            <Button variant="secondary" onClick={() => setAddOpen(false)}>Cancel</Button>
            <Button loading={busy} icon={Plus} onClick={addEntry}>Add to log</Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="inline-flex rounded-xl border border-ink-200 bg-white p-1">
            {(['pantry', 'custom'] as const).map((m) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={cn(
                  'rounded-lg px-3 py-1.5 text-[12.5px] font-semibold transition',
                  mode === m ? 'bg-ink-950 text-white' : 'text-ink-500 hover:text-ink-800'
                )}
              >
                {m === 'pantry' ? 'From pantry' : 'Custom item'}
              </button>
            ))}
          </div>

          {mode === 'pantry' ? (
            pantry.length === 0 ? (
              <EmptyState
                compact
                icon={Search}
                title="Your pantry is empty"
                description="Add products to your pantry first, or switch to a custom item."
              />
            ) : (
              <div className="space-y-2">
                <div className="relative">
                  <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
                  <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search pantry…" className="pl-8" />
                </div>
                <div className="max-h-[220px] space-y-1.5 overflow-y-auto pr-1">
                  {filteredPantry.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => {
                        setProductId(p.id);
                        setPortionG(p.servingG);
                      }}
                      className={cn(
                        'flex w-full items-center gap-2.5 rounded-xl border p-2.5 text-left transition',
                        productId === p.id ? 'border-brand-500 bg-brand-50/60 ring-2 ring-brand-500/15' : 'border-ink-100 hover:bg-ink-50'
                      )}
                    >
                      <span className="text-lg">{p.emoji}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[12.5px] font-medium text-ink-900">{p.name}</span>
                        <span className="block text-[11px] text-ink-400">
                          {p.servingG} g serving · {nf(p.nutrition.kcal)} kcal/100 g
                        </span>
                      </span>
                      <Chip tone={toneForScore(p.score)} className="shrink-0">{p.score}</Chip>
                    </button>
                  ))}
                </div>
              </div>
            )
          ) : (
            <div className="space-y-3">
              <Field label="Food name">
                <Input value={customName} onChange={(e) => setCustomName(e.target.value)} placeholder="e.g. Curd rice, home-made" />
              </Field>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-400">Nutrition per 100 g (optional, rough is fine)</p>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                <NumberField label="Energy" unit="kcal" value={custom.kcal} onChange={(v) => setCustom((c) => ({ ...c, kcal: v }))} />
                <NumberField label="Sugar" unit="g" value={custom.sugar} onChange={(v) => setCustom((c) => ({ ...c, sugar: v }))} step={0.1} />
                <NumberField label="Sodium" unit="mg" value={custom.sodium} onChange={(v) => setCustom((c) => ({ ...c, sodium: v }))} />
                <NumberField label="Sat fat" unit="g" value={custom.satfat} onChange={(v) => setCustom((c) => ({ ...c, satfat: v }))} step={0.1} />
                <NumberField label="Fat" unit="g" value={custom.fat} onChange={(v) => setCustom((c) => ({ ...c, fat: v }))} step={0.1} />
                <NumberField label="Carbs" unit="g" value={custom.carbs} onChange={(v) => setCustom((c) => ({ ...c, carbs: v }))} step={0.1} />
                <NumberField label="Fibre" unit="g" value={custom.fiber} onChange={(v) => setCustom((c) => ({ ...c, fiber: v }))} step={0.1} />
                <NumberField label="Protein" unit="g" value={custom.protein} onChange={(v) => setCustom((c) => ({ ...c, protein: v }))} step={0.1} />
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 grid gap-3 sm:grid-cols-2">
            <Field label="Portion size">
              <div className="relative">
                <Input type="number" min={1} value={portionG || ''} onChange={(e) => setPortionG(Number(e.target.value))} className="pr-9" />
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[11px] font-medium text-ink-400">g</span>
              </div>
            </Field>
            <Field label="Meal">
              <Select value={meal} onChange={(e) => setMeal(e.target.value as any)}>
                {MEAL_META.map((m) => (
                  <option key={m.id} value={m.id}>{m.label}</option>
                ))}
              </Select>
            </Field>
          </div>

          {selectedProduct && mode === 'pantry' && (
            <div className="rounded-xl bg-ink-50 p-3 text-[12px] text-ink-600">
              {portionG} g of {selectedProduct.name} ≈{' '}
              <strong className="font-semibold text-ink-900">{nf((selectedProduct.nutrition.kcal * portionG) / 100)} kcal</strong>,{' '}
              <strong className="font-semibold text-ink-900">{nf((selectedProduct.nutrition.sugar * portionG) / 100, 1)} g sugar</strong>,{' '}
              <strong className="font-semibold text-ink-900">{nf((selectedProduct.nutrition.sodium * portionG) / 100)} mg sodium</strong>
            </div>
          )}

          {formError && (
            <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-[13px] font-medium text-red-700">
              <TriangleAlert size={14} /> {formError}
            </div>
          )}
        </div>
      </Modal>

      {/* edit modal */}
      <EditEntryModal entry={editing} onClose={() => setEditing(null)} onSave={saveEdit} />

      {/* delete modal */}
      <Modal
        open={!!deleting}
        onClose={() => setDeleting(null)}
        size="sm"
        title="Remove this entry?"
        footer={
          <>
            <Button variant="secondary" onClick={() => setDeleting(null)}>Keep it</Button>
            <Button variant="danger" icon={Trash2} onClick={confirmDelete}>Remove</Button>
          </>
        }
      >
        {deleting && (
          <p className="text-[13px] leading-relaxed text-ink-600">
            <strong className="font-semibold text-ink-900">{deleting.name}</strong> ({deleting.portionG} g) will be removed from{' '}
            {relativeDay(date).toLowerCase()}'s log. This can't be undone.
          </p>
        )}
      </Modal>
    </div>
  );
}

function EditEntryModal({
  entry, onClose, onSave,
}: {
  entry: IntakeEntry | null;
  onClose: () => void;
  onSave: (patch: { portionG?: number; meal?: 'breakfast' | 'lunch' | 'dinner' | 'snack'; name?: string }) => void;
}) {
  const [portionG, setPortionG] = useState(0);
  const [meal, setMeal] = useState<'breakfast' | 'lunch' | 'dinner' | 'snack'>('snack');
  const [name, setName] = useState('');

  useEffect(() => {
    if (entry) {
      setPortionG(entry.portionG);
      setMeal(entry.meal);
      setName(entry.name);
    }
  }, [entry]);

  return (
    <Modal
      open={!!entry}
      onClose={onClose}
      size="sm"
      title="Edit entry"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={() => onSave({ portionG, meal, name })}>Save changes</Button>
        </>
      }
    >
      <div className="space-y-3">
        <Field label="Food">
          <Input value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label="Portion size">
          <div className="relative">
            <Input type="number" min={1} value={portionG || ''} onChange={(e) => setPortionG(Number(e.target.value))} className="pr-9" />
            <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[11px] font-medium text-ink-400">g</span>
          </div>
        </Field>
        <Field label="Meal">
          <Select value={meal} onChange={(e) => setMeal(e.target.value as any)}>
            {MEAL_META.map((m) => (
              <option key={m.id} value={m.id}>{m.label}</option>
            ))}
          </Select>
        </Field>
      </div>
    </Modal>
  );
}
