import { useEffect, useMemo, useState } from 'react';
import {
  BookOpen, FlaskConical, HeartPulse, Info, Leaf, Scale, Search, ShieldAlert, Sparkles, TriangleAlert, X,
} from 'lucide-react';
import { api } from '../lib/api';
import type { Additive, Alternative, Meta } from '../lib/types';
import { Button, Card, CardHeader, Chip, EmptyState, Input, Skeleton } from '../components/ui';
import { cn, nf, toneForScore, severityTone, TONE_CHIP } from '../lib/utils';

const TABS = [
  { id: 'additives', label: 'Additive decoder', icon: FlaskConical },
  { id: 'swaps', label: 'Swap library', icon: Leaf },
  { id: 'scoring', label: 'How scoring works', icon: Scale },
  { id: 'conditions', label: 'Conditions', icon: HeartPulse },
] as const;

type TabId = (typeof TABS)[number]['id'];

export default function Learn() {
  const [tab, setTab] = useState<TabId>('additives');
  const [additives, setAdditives] = useState<Additive[]>([]);
  const [alternatives, setAlternatives] = useState<Alternative[]>([]);
  const [meta, setMeta] = useState<Meta | null>(null);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [level, setLevel] = useState<'all' | 'high' | 'medium' | 'low'>('all');

  useEffect(() => {
    setLoading(true);
    Promise.all([api.library.additives(), api.library.alternatives(), api.meta()])
      .then(([a, alts, m]) => {
        setAdditives(a.items);
        setAlternatives(alts.items);
        setMeta(m);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    let list = additives;
    if (level !== 'all') list = list.filter((a) => a.level === level);
    if (query.trim()) {
      const q = query.toLowerCase();
      list = list.filter((a) => `${a.code} ${a.name} ${a.category} ${a.why} ${a.found.join(' ')}`.toLowerCase().includes(q));
    }
    const order = { high: 0, medium: 1, low: 2 };
    return [...list].sort((a, b) => order[a.level] - order[b.level]);
  }, [additives, level, query]);

  const groupedAlternatives = useMemo(() => {
    const map = new Map<string, Alternative[]>();
    for (const a of alternatives) {
      const cat = meta?.categories.find((c) => c.id === a.category)?.label || a.category;
      if (!map.has(cat)) map.set(cat, []);
      map.get(cat)!.push(a);
    }
    return [...map.entries()];
  }, [alternatives, meta]);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-[26px] font-bold tracking-tight text-ink-900 sm:text-[30px]">Learn the label</h1>
        <p className="mt-1 max-w-2xl text-[13.5px] leading-relaxed text-ink-500">
          The reference library behind every score: what each additive does, why the daily caps exist, and the swaps that keep the
          food you love without the consequences.
        </p>
      </div>

      <div className="flex gap-1 overflow-x-auto rounded-2xl border border-ink-100 bg-white p-1.5 shadow-card">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              'flex shrink-0 items-center gap-2 rounded-xl px-3.5 py-2 text-[12.5px] font-semibold transition',
              tab === t.id ? 'bg-ink-950 text-white shadow-sm' : 'text-ink-500 hover:bg-ink-50 hover:text-ink-800'
            )}
          >
            <t.icon size={14} />
            {t.label}
          </button>
        ))}
      </div>

      {/* ---------------------------------------------------------- additives */}
      {tab === 'additives' && (
        <>
          <Card className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search size={15} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-400" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search an E-number, name or symptom (e.g. 621, colour, asthma)…"
                className="border-transparent bg-ink-50/70 pl-9 focus:bg-white"
              />
            </div>
            <div className="flex gap-1.5">
              {(['all', 'high', 'medium', 'low'] as const).map((l) => (
                <button
                  key={l}
                  onClick={() => setLevel(l)}
                  className={cn(
                    'rounded-lg px-2.5 py-1.5 text-[11.5px] font-semibold capitalize ring-1 transition',
                    level === l ? 'bg-ink-950 text-white ring-ink-950' : 'bg-white text-ink-500 ring-ink-200 hover:bg-ink-50'
                  )}
                >
                  {l === 'all' ? 'All levels' : l}
                </button>
              ))}
            </div>
          </Card>

          {loading ? (
            <div className="grid grid-cols-1 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <Card key={i} className="card-pad space-y-2">
                  <Skeleton className="h-4 w-2/3" />
                  <Skeleton className="h-3 w-1/3" />
                  <Skeleton className="h-3 w-full" />
                  <Skeleton className="h-3 w-5/6" />
                </Card>
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <Card>
              <EmptyState
                icon={Search}
                title="No additives match that search"
                description="Try a shorter term — codes like 621, 211 or 951 work well."
                action={<Button variant="secondary" icon={X} onClick={() => { setQuery(''); setLevel('all'); }}>Clear search</Button>}
              />
            </Card>
          ) : (
            <div className="grid grid-cols-1 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {filtered.map((a) => (
                <Card key={a.code} className="flex flex-col p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-[13.5px] font-semibold leading-snug text-ink-900">{a.name}</p>
                      <p className="mt-0.5 text-[11px] text-ink-400">
                        {a.category}
                        {/^[0-9]/.test(a.code) ? ` · INS ${a.code.toUpperCase()}` : ''}
                      </p>
                    </div>
                    <Chip tone={severityTone(a.level)} className="shrink-0 capitalize">{a.level}</Chip>
                  </div>
                  <p className="mt-2 text-[12px] leading-relaxed text-ink-600">{a.what}</p>
                  <p className="mt-1.5 text-[12px] leading-relaxed text-ink-500">
                    <span className="font-medium text-ink-700">Why it matters: </span>
                    {a.why}
                  </p>
                  <div className="mt-auto flex flex-wrap gap-1 pt-2.5">
                    {a.found.slice(0, 4).map((f) => (
                      <span key={f} className="rounded-md bg-ink-50 px-1.5 py-0.5 text-[10.5px] text-ink-500">{f}</span>
                    ))}
                  </div>
                </Card>
              ))}
            </div>
          )}
        </>
      )}

      {/* -------------------------------------------------------------- swaps */}
      {tab === 'swaps' && (
        <div className="space-y-5">
          <Card className="bg-gradient-to-br from-brand-50 to-lime-50 p-5 ring-1 ring-inset ring-brand-100">
            <p className="flex items-center gap-2 text-[13px] font-semibold text-brand-900">
              <Sparkles size={15} /> Swaps are ranked by how much risk they remove, not by how "healthy" they sound
            </p>
            <p className="mt-1.5 max-w-3xl text-[12.5px] leading-relaxed text-brand-800/80">
              A swap only shows up if it genuinely scores better on the same engine — less sugar, less sodium, less saturated fat or more fibre.
              Every item is scored per 100 g so you can compare fairly.
            </p>
          </Card>

          {loading ? (
            <div className="grid grid-cols-1 grid gap-3 sm:grid-cols-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <Card key={i} className="card-pad space-y-2">
                  <Skeleton className="h-4 w-1/2" />
                  <Skeleton className="h-3 w-full" />
                  <Skeleton className="h-3 w-4/5" />
                </Card>
              ))}
            </div>
          ) : (
            groupedAlternatives.map(([category, items]) => (
              <div key={category}>
                <p className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-wider text-ink-400">Instead of {category.toLowerCase()}</p>
                <div className="grid grid-cols-1 grid gap-3 sm:grid-cols-2">
                  {items.map((a) => (
                    <Card key={a.id} className="p-4">
                      <div className="flex items-start gap-3">
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-ink-50 text-xl">{a.emoji}</span>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-2">
                            <p className="text-[13px] font-semibold leading-snug text-ink-900">{a.name}</p>
                            <Chip tone={toneForScore(a.score)} className="shrink-0">{a.score}</Chip>
                          </div>
                          <p className="mt-1 text-[12px] leading-relaxed text-ink-600">{a.description}</p>
                          <p className="mt-1 text-[12px] leading-relaxed text-ink-500">{a.swapReason}</p>
                          <div className="mt-2 flex flex-wrap gap-1">
                            <span className="rounded-md bg-ink-50 px-1.5 py-0.5 text-[10.5px] text-ink-500">{nf(a.nutrition.kcal)} kcal/100 g</span>
                            <span className="rounded-md bg-ink-50 px-1.5 py-0.5 text-[10.5px] text-ink-500">sugar {nf(a.nutrition.sugar, 1)} g</span>
                            <span className="rounded-md bg-ink-50 px-1.5 py-0.5 text-[10.5px] text-ink-500">sodium {nf(a.nutrition.sodium)} mg</span>
                            <span className="rounded-md bg-ink-50 px-1.5 py-0.5 text-[10.5px] text-ink-500">fibre {nf(a.nutrition.fiber, 1)} g</span>
                          </div>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* ------------------------------------------------------------ scoring */}
      {tab === 'scoring' && (
        <div className="grid grid-cols-1 grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader title="How the risk score is built" subtitle="Every food gets 0–100. Lower is better." icon={Scale} />
            <div className="card-pad space-y-3">
              {[
                { label: 'Sugar load', weight: 22, note: 'Free sugars per 100 g against the 50 g daily cap.' },
                { label: 'Sodium load', weight: 17, note: 'Milligrams per 100 g against the 2,000 mg cap.' },
                { label: 'Calorie density', weight: 13, note: 'How much energy arrives before fullness does.' },
                { label: 'Saturated fat', weight: 12, note: 'LDL-raising fat, 20 g daily cap.' },
                { label: 'Low fibre', weight: 11, note: 'Fibre slows glucose and feeds the microbiome.' },
                { label: 'Additive load', weight: 10, note: 'Weighted by risk level of each detected additive.' },
                { label: 'Ultra-processing', weight: 8, note: 'NOVA class 4 foods carry the strongest long-term signal.' },
                { label: 'Trans fat', weight: 7, note: 'Any industrial trans fat is treated harshly — WHO target is zero.' },
              ].map((row) => (
                <div key={row.label}>
                  <div className="flex items-baseline justify-between text-[12.5px]">
                    <span className="font-medium text-ink-700">{row.label}</span>
                    <span className="tabular-nums text-ink-400">{row.weight}%</span>
                  </div>
                  <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-ink-100">
                    <div className="h-full rounded-full bg-brand-500" style={{ width: `${(row.weight / 22) * 100}%` }} />
                  </div>
                  <p className="mt-1 text-[11.5px] text-ink-400">{row.note}</p>
                </div>
              ))}
            </div>
          </Card>

          <div className="space-y-4">
            <Card>
              <CardHeader title="Daily reference caps" subtitle="WHO / ICMR-NIN guidance for an average adult" icon={Info} />
              <div className="divide-y divide-ink-100">
                {[
                  { label: 'Free sugars', value: '50 g', ideal: 'ideal < 25 g' },
                  { label: 'Sodium', value: '2,000 mg', ideal: '≈ 5 g salt' },
                  { label: 'Saturated fat', value: '20 g', ideal: '10% of energy' },
                  { label: 'Industrial trans fat', value: '< 1 g', ideal: 'aim for zero' },
                  { label: 'Fibre', value: '30 g', ideal: 'minimum' },
                  { label: 'Energy (snack cap)', value: '500 kcal', ideal: '25% of daily energy' },
                ].map((r) => (
                  <div key={r.label} className="flex items-center justify-between px-5 py-2.5 text-[12.5px]">
                    <span className="text-ink-600">{r.label}</span>
                    <span className="text-right">
                      <span className="font-semibold text-ink-900">{r.value}</span>
                      <span className="ml-2 text-[11px] text-ink-400">{r.ideal}</span>
                    </span>
                  </div>
                ))}
              </div>
            </Card>

            <Card>
              <CardHeader title="Verdict bands" subtitle="What each score range means" icon={TriangleAlert} />
              <div className="card-pad space-y-2">
                {[
                  { range: '0–19', label: 'Everyday friendly', tone: 'emerald' as const, text: 'Fine as a regular part of balanced meals.' },
                  { range: '20–39', label: 'Okay in moderation', tone: 'lime' as const, text: 'Two to three times a week.' },
                  { range: '40–59', label: 'Keep it occasional', tone: 'amber' as const, text: 'Once or twice a week, small portions.' },
                  { range: '60–79', label: 'High risk', tone: 'orange' as const, text: 'Treat food — daily use pushes chronic disease.' },
                  { range: '80–100', label: 'Avoid as a habit', tone: 'red' as const, text: 'Rare occasions only; find a swap.' },
                ].map((b) => (
                  <div key={b.range} className={cn('flex items-start gap-2.5 rounded-xl px-3 py-2 ring-1 ring-inset', TONE_CHIP[b.tone])}>
                    <span className="mt-0.5 w-12 shrink-0 text-[11px] font-bold tabular-nums">{b.range}</span>
                    <div>
                      <p className="text-[12.5px] font-semibold">{b.label}</p>
                      <p className="text-[11.5px] opacity-80">{b.text}</p>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </div>
      )}

      {/* --------------------------------------------------------- conditions */}
      {tab === 'conditions' && (
        <div className="space-y-4">
          <Card className="border-amber-200 bg-amber-50/60 p-4">
            <p className="flex items-start gap-2 text-[12.5px] leading-relaxed text-amber-900">
              <ShieldAlert size={15} className="mt-0.5 shrink-0" />
              NutriLens adjusts every score using the conditions on your profile. It is educational guidance built from population-level
              nutrition research — not a diagnosis, and not a substitute for your doctor or dietitian.
            </p>
          </Card>
          <div className="grid grid-cols-1 grid gap-3 sm:grid-cols-2">
            {(meta?.conditions || []).map((c) => (
              <Card key={c.id} className="p-4">
                <div className="flex items-center gap-2">
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
                    <HeartPulse size={15} />
                  </span>
                  <p className="text-[13.5px] font-semibold text-ink-900">{c.label}</p>
                </div>
                <p className="mt-2 text-[12.5px] leading-relaxed text-ink-500">{c.blurb}</p>
                <p className="mt-2 text-[12px] leading-relaxed text-ink-400">
                  {{
                    diabetes: 'Priority nutrients: free sugar, refined carbohydrate, glycaemic load, fibre. Each scan shows the sugar load and the glucose-spike mechanism.',
                    obesity: 'Priority nutrients: calorie density and satiety. We translate surplus calories into kilograms per year so the trade-off is concrete.',
                    hypertension: 'Priority nutrient: sodium. Every scan tells you what share of the 2,000 mg daily cap the serving uses.',
                    heart: 'Priority nutrients: saturated and trans fat. We flag any industrial trans fat, since the WHO target is complete elimination.',
                    fattyliver: 'Priority nutrient: sugar, especially fructose from syrups and juices, which is metabolised directly by the liver.',
                    pcos: 'Priority: insulin response. High-glycaemic, low-fibre foods worsen the insulin resistance behind PCOS symptoms.',
                    kidney: 'Priority nutrients: sodium and phosphorus. Colas and processed foods add both.',
                    cancer: 'Priority: additive exposure and ultra-processing. Processed meats and some dyes carry the strongest evidence.',
                    gut: 'Priority: emulsifiers, thickeners and fibre. Additives can thin the protective mucus layer.',
                    gout: 'Priority: purine-rich flavour enhancers (disodium guanylate, inosinate, ribonucleotides) and alcohol.',
                  }[c.id] || c.blurb}
                </p>
              </Card>
            ))}
          </div>
        </div>
      )}

      <p className="px-1 pb-2 text-center text-[11px] leading-relaxed text-ink-400">
        Sources: WHO guideline on free sugars & sodium, ICMR-NIN Dietary Guidelines for Indians (2024), NOVA classification, BMJ umbrella review
        of ultra-processed foods (2024), UK FSA front-of-pack nutrient profiling.
      </p>
    </div>
  );
}
