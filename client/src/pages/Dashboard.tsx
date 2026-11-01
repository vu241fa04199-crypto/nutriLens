import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowRight, ArrowUpRight, CalendarDays, ClipboardList, Flame, Leaf, Package, Plus, ScanLine,
  Sparkles, TrendingDown, TrendingUp, TriangleAlert, Activity, Utensils,
} from 'lucide-react';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import type { DashboardData } from '../lib/types';
import { Button, Card, CardHeader, Chip, EmptyState, Progress, ScoreChip, Skeleton, SkeletonCard } from '../components/ui';
import { NutrientBars, RiskTrendChart, VerdictDonut, WeekSugarChart } from '../components/charts';
import { ScoreRing } from '../components/ScoreRing';
import { cn, greeting, nf, pct, relativeDay, timeAgo, toneForScore, TONE_TEXT, todayKey, verdictLabel, prettyDate } from '../lib/utils';

function StatCard({
  label,
  value,
  unit,
  hint,
  icon: Icon,
  tone = 'slate',
  footer,
}: {
  label: string;
  value: React.ReactNode;
  unit?: string;
  hint?: React.ReactNode;
  icon: any;
  tone?: 'emerald' | 'amber' | 'orange' | 'red' | 'sky' | 'slate';
  footer?: React.ReactNode;
}) {
  const iconTone = {
    emerald: 'bg-emerald-50 text-emerald-600',
    amber: 'bg-amber-50 text-amber-600',
    orange: 'bg-orange-50 text-orange-600',
    red: 'bg-red-50 text-red-600',
    sky: 'bg-sky-50 text-sky-600',
    slate: 'bg-ink-100 text-ink-500',
  }[tone];

  return (
    <Card className="card-pad">
      <div className="flex items-start justify-between">
        <p className="text-[12.5px] font-medium text-ink-500">{label}</p>
        <span className={cn('flex h-8 w-8 items-center justify-center rounded-lg', iconTone)}>
          <Icon size={15} />
        </span>
      </div>
      <div className="mt-2.5 flex items-baseline gap-1">
        <span className="font-display text-[26px] font-bold leading-none tabular-nums tracking-tight text-ink-900">{value}</span>
        {unit && <span className="text-[13px] font-medium text-ink-400">{unit}</span>}
      </div>
      {hint && <div className="mt-1.5 text-[12px] text-ink-500">{hint}</div>}
      {footer && <div className="mt-3">{footer}</div>}
    </Card>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    api
      .dashboard(todayKey())
      .then((d) => alive && setData(d))
      .catch((e) => alive && setError(e.message || 'Could not load your dashboard.'))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, []);

  const firstName = user?.name?.split(' ')[0] || 'there';

  if (loading) {
    return (
      <div className="space-y-5">
        <div className="space-y-2">
          <Skeleton className="h-7 w-64" />
          <Skeleton className="h-4 w-80" />
        </div>
        <div className="grid grid-cols-1 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <SkeletonCard key={i} rows={2} />
          ))}
        </div>
        <div className="grid grid-cols-1 grid gap-4 lg:grid-cols-3">
          <SkeletonCard className="lg:col-span-2" rows={5} />
          <SkeletonCard rows={5} />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <Card className="card-pad">
        <EmptyState
          icon={TriangleAlert}
          title="We couldn't load your dashboard"
          description={error}
          action={<Button onClick={() => window.location.reload()}>Try again</Button>}
        />
      </Card>
    );
  }

  if (!data) return null;

  const { stats, trend, buckets, offenders, recentScans, today, swap, weekSeries } = data;
  const hasScans = stats.scansTotal > 0;
  const delta = stats.avgScoreThisWeek != null && stats.avgScore != null ? stats.avgScoreThisWeek - stats.avgScore : null;

  return (
    <div className="space-y-5">
      {/* ------------------------------------------------------------- header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-[12px] font-medium text-ink-400">
            <CalendarDays size={13} />
            {prettyDate(todayKey())}
            <span className="text-ink-200">•</span>
            <span>{stats.trackedDays} day{stats.trackedDays === 1 ? '' : 's'} tracked</span>
          </div>
          <h1 className="mt-1.5 font-display text-[26px] font-bold tracking-tight text-ink-900 sm:text-[30px]">
            {greeting()}, {firstName}
          </h1>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            {data.conditions.length ? (
              <>
                <span className="text-[12px] text-ink-400">Scoring against:</span>
                {data.conditions.slice(0, 4).map((c) => (
                  <Chip key={c} tone="sky">{c}</Chip>
                ))}
              </>
            ) : (
              <Link to="/profile" className="chip bg-ink-100 text-ink-600 ring-ink-200 hover:bg-ink-200">
                <Sparkles size={12} /> Add your health conditions for personalised scores
              </Link>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" icon={ClipboardList} onClick={() => navigate('/log')}>
            Log food
          </Button>
          <Button icon={ScanLine} onClick={() => navigate('/scan')}>
            Scan a label
          </Button>
        </div>
      </div>

      {/* ----------------------------------------------------------- stat row */}
      <div className="grid grid-cols-1 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Average risk score"
          value={stats.avgScore ?? '—'}
          unit={stats.avgScore != null ? '/100' : undefined}
          icon={Activity}
          tone={stats.avgScore == null ? 'slate' : (toneForScore(stats.avgScore) as any)}
          hint={
            stats.avgScore != null ? (
              <span className={cn('font-semibold', TONE_TEXT[toneForScore(stats.avgScore)])}>{verdictLabel(stats.avgScore)}</span>
            ) : (
              'Scan a label to get started'
            )
          }
          footer={
            delta != null && (
              <span className={cn('inline-flex items-center gap-1 text-[11.5px] font-medium', delta > 0 ? 'text-red-600' : 'text-emerald-600')}>
                {delta > 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                {delta === 0 ? 'flat' : `${delta > 0 ? '+' : ''}${delta} pts vs all-time`}
              </span>
            )
          }
        />
        <StatCard
          label="Scans this week"
          value={stats.scansThisWeek}
          icon={ScanLine}
          tone="sky"
          hint={<>of {stats.scansTotal} total scans</>}
          footer={
            <div className="flex items-center gap-2">
              <Progress value={stats.scansThisWeek} max={Math.max(stats.scansTotal, 1)} size="sm" tone="sky" className="flex-1" />
              <span className="text-[11px] tabular-nums text-ink-400">{pct(stats.scansThisWeek, Math.max(stats.scansTotal, 1))}%</span>
            </div>
          }
        />
        <StatCard
          label="Sugar today"
          value={nf(stats.sugarToday, 1)}
          unit={`g / ${data.limits.sugar} g`}
          icon={Flame}
          tone={stats.sugarPct > 100 ? 'red' : stats.sugarPct > 75 ? 'orange' : 'amber'}
          hint={<>{stats.sugarPct}% of the WHO free-sugar cap</>}
          footer={<Progress value={stats.sugarToday} max={data.limits.sugar} size="sm" />}
        />
        <StatCard
          label="Fibre today"
          value={nf(stats.fiberToday, 1)}
          unit={`g / ${data.limits.fiber} g`}
          icon={Leaf}
          tone="emerald"
          hint={<>{pct(stats.fiberToday, data.limits.fiber)}% of the 30 g target</>}
          footer={<Progress value={stats.fiberToday} max={data.limits.fiber} size="sm" invert />}
        />
      </div>

      {!hasScans && (
        <Card className="overflow-hidden">
          <div className="grid grid-cols-1 grid gap-6 p-6 sm:grid-cols-[1.4fr_1fr] sm:p-8">
            <div>
              <Chip tone="emerald">Step 1</Chip>
              <h2 className="mt-3 font-display text-[22px] font-bold tracking-tight text-ink-900">Your first label, decoded</h2>
              <p className="mt-2 max-w-md text-[13.5px] leading-relaxed text-ink-500">
                Paste any nutrition table — or type the values by hand. NutriLens will tell you what happens to your body if you
                keep eating it, how much is safe in a day, and what to swap it for.
              </p>
              <Button className="mt-4" icon={ScanLine} onClick={() => navigate('/scan')}>
                Scan your first label
              </Button>
            </div>
            <div className="flex items-center justify-center rounded-2xl bg-gradient-to-br from-brand-50 to-lime-50 p-4 ring-1 ring-brand-100">
              <ScoreRing score={0} size={120} label="risk" sublabel="awaiting scan" />
            </div>
          </div>
        </Card>
      )}

      {/* -------------------------------------------------------- trend + mix */}
      <div className="grid grid-cols-1 grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader
            title="Risk trend"
            subtitle="Average score of everything you scanned, last 14 days"
            icon={Activity}
            action={
              <div className="hidden items-center gap-3 text-[11px] text-ink-400 sm:flex">
                <span className="flex items-center gap-1"><span className="h-1.5 w-3 rounded-full bg-amber-400" /> avg score</span>
                <span className="flex items-center gap-1"><span className="h-px w-3 border-t border-dashed border-emerald-300" /> 40</span>
                <span className="flex items-center gap-1"><span className="h-px w-3 border-t border-dashed border-red-300" /> 70</span>
              </div>
            }
          />
          <div className="px-3 pb-4 pt-3 sm:px-5">
            {hasScans ? (
              <RiskTrendChart data={trend} />
            ) : (
              <EmptyState compact icon={Activity} title="No trend yet" description="Scores appear here as soon as you scan something." />
            )}
          </div>
        </Card>

        <Card>
          <CardHeader title="What you scan" subtitle="Distribution by verdict" icon={Package} />
          <div className="card-pad">
            <VerdictDonut buckets={buckets} />
            <Link to="/scan" className="mt-4 flex items-center justify-between rounded-xl bg-ink-50 px-3.5 py-2.5 text-[12.5px] font-medium text-ink-600 transition hover:bg-ink-100">
              Scan something new <ArrowRight size={14} />
            </Link>
          </div>
        </Card>
      </div>

      {/* --------------------------------------------------- today + swap */}
      <div className="grid grid-cols-1 grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader
            title="Today's intake vs your daily caps"
            subtitle={`${today.entries.length} item${today.entries.length === 1 ? '' : 's'} logged · ${nf(today.totals.kcal)} kcal`}
            icon={Utensils}
            action={
              <Button variant="ghost" size="sm" onClick={() => navigate('/log')} iconRight={ArrowRight}>
                Open log
              </Button>
            }
          />
          <div className="card-pad">
            {today.entries.length === 0 ? (
              <EmptyState
                compact
                icon={ClipboardList}
                title="Nothing logged today"
                description="Log what you eat to see how fast you spend your daily sugar, sodium and saturated-fat budget."
                action={<Button size="sm" variant="secondary" icon={Plus} onClick={() => navigate('/log')}>Log your first meal</Button>}
              />
            ) : (
              <>
                <NutrientBars
                  items={[
                    { label: 'Energy', value: today.totals.kcal, limit: data.limits.kcal, unit: 'kcal' },
                    { label: 'Free sugar', value: today.totals.sugar, limit: data.limits.sugar, unit: 'g' },
                    { label: 'Sodium', value: today.totals.sodium, limit: data.limits.sodium, unit: 'mg' },
                    { label: 'Saturated fat', value: today.totals.satfat, limit: data.limits.satfat, unit: 'g' },
                    { label: 'Fibre', value: today.totals.fiber, limit: data.limits.fiber, unit: 'g', positive: true },
                    { label: 'Protein', value: today.totals.protein, limit: data.limits.protein, unit: 'g', positive: true },
                  ]}
                />
                <div className="grid grid-cols-1 mt-4 grid gap-2 sm:grid-cols-2">
                  {today.entries.slice(0, 4).map((e) => (
                    <div key={e.id} className="flex items-center justify-between gap-2 rounded-xl bg-ink-50/70 px-3 py-2">
                      <span className="min-w-0 truncate text-[12.5px] font-medium text-ink-700">{e.name}</span>
                      <span className="shrink-0 text-[11.5px] tabular-nums text-ink-400">{nf(e.nutrition?.kcal)} kcal</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </Card>

        <div className="space-y-4">
          <Card className="overflow-hidden">
            <CardHeader title="This week's sugar" subtitle="Red bars are days over the cap" icon={Flame} />
            <div className="px-3 pb-4 pt-2">
              {weekSeries.some((d) => d.sugar > 0) ? (
                <WeekSugarChart data={weekSeries.map((d) => ({ label: d.label, sugar: d.sugar }))} limit={data.limits.sugar} />
              ) : (
                <EmptyState compact icon={Flame} title="No sugar logged yet" description="Log a meal and this fills in day by day." />
              )}
            </div>
          </Card>

          {swap ? (
            <Card className="relative overflow-hidden bg-gradient-to-br from-ink-950 to-ink-900 p-5 text-white">
              <div className="pointer-events-none absolute -right-8 -top-10 h-32 w-32 rounded-full bg-brand-500/20 blur-2xl" />
              <div className="relative">
                <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-brand-300">
                  <Sparkles size={12} /> Suggested swap
                </p>
                <div className="mt-2 flex items-center gap-2 text-[13px]">
                  <span className="rounded-md bg-red-400/15 px-1.5 py-0.5 font-semibold text-red-300">{swap.scan.score}</span>
                  <span className="truncate font-medium text-white/80">{swap.scan.productName}</span>
                </div>
                <div className="my-2 flex items-center gap-2 text-[11px] text-white/40">
                  <ArrowRight size={12} /> instead try
                </div>
                <div className="flex items-center gap-2 text-[13px]">
                  <span className="rounded-md bg-brand-400/20 px-1.5 py-0.5 font-semibold text-brand-200">{swap.alternative.score}</span>
                  <span className="truncate font-semibold text-white">{swap.alternative.emoji} {swap.alternative.name}</span>
                </div>
                <p className="mt-2.5 line-clamp-3 text-[12px] leading-relaxed text-white/50">{swap.alternative.swapReason}</p>
                <Link
                  to="/learn"
                  className="mt-3.5 inline-flex items-center gap-1.5 rounded-lg bg-white/10 px-3 py-1.5 text-[12px] font-semibold text-white transition hover:bg-white/20"
                >
                  More swaps <ArrowUpRight size={13} />
                </Link>
              </div>
            </Card>
          ) : (
            <Card className="card-pad">
              <p className="text-[13px] font-semibold text-ink-900">No swaps to suggest yet</p>
              <p className="mt-1 text-[12.5px] text-ink-500">Scan a few packaged foods and we'll line up healthier replacements.</p>
            </Card>
          )}
        </div>
      </div>

      {/* ------------------------------------------------ recent + offenders */}
      <div className="grid grid-cols-1 grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader
            title="Recent scans"
            subtitle="Tap any row to reopen the full report"
            icon={ScanLine}
            action={
              <Button variant="ghost" size="sm" onClick={() => navigate('/scan')} iconRight={ArrowRight}>
                New scan
              </Button>
            }
          />
          {recentScans.length === 0 ? (
            <EmptyState
              icon={ScanLine}
              title="No scans yet"
              description="Scan a nutrition label and NutriLens will keep the report here for you."
              action={<Button size="sm" icon={ScanLine} onClick={() => navigate('/scan')}>Scan a label</Button>}
            />
          ) : (
            <div className="divide-y divide-ink-100">
              {recentScans.map((s) => (
                <button
                  key={s.id}
                  onClick={() => navigate(`/scan?scan=${s.id}`)}
                  className="flex w-full items-center gap-3 px-5 py-3 text-left transition hover:bg-ink-50/70 sm:px-6"
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-ink-50">
                    <span className={cn('text-[13px] font-bold tabular-nums', TONE_TEXT[toneForScore(s.score)])}>{s.score}</span>
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13.5px] font-semibold text-ink-900">{s.productName}</span>
                    <span className="block truncate text-[11.5px] text-ink-400">
                      {s.brand || s.category} · {s.portionG} g portion · {timeAgo(s.createdAt)}
                    </span>
                  </span>
                  <Chip tone={toneForScore(s.score)} className="hidden sm:inline-flex">{s.verdictLabel}</Chip>
                  <ArrowRight size={14} className="shrink-0 text-ink-300" />
                </button>
              ))}
            </div>
          )}
        </Card>

        <Card>
          <CardHeader title="Watch list" subtitle="Worst offenders in your history" icon={TriangleAlert} />
          {offenders.length === 0 ? (
            <EmptyState compact icon={TriangleAlert} title="Nothing flagged" description="Your scanned items are all on the safer side." />
          ) : (
            <ul className="divide-y divide-ink-100">
              {offenders.map((s) => (
                <li key={s.id}>
                  <Link to={`/scan?scan=${s.id}`} className="flex items-center gap-3 px-5 py-3 transition hover:bg-ink-50/70">
                    <ScoreChip score={s.score} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-semibold text-ink-900">{s.productName}</p>
                      <p className="text-[11.5px] text-ink-400">{s.verdictLabel}</p>
                    </div>
                    <ArrowRight size={13} className="text-ink-300" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
          <div className="border-t border-ink-100 px-5 py-3">
            <Link to="/pantry" className="flex items-center justify-between text-[12.5px] font-medium text-ink-600 hover:text-ink-900">
              Manage pantry <ArrowRight size={13} />
            </Link>
          </div>
        </Card>
      </div>

      <p className="px-1 text-center text-[11px] text-ink-400">
        Daily caps shown: {data.limits.sugar} g free sugar · {data.limits.sodium} mg sodium · {data.limits.satfat} g saturated fat ·{' '}
        {data.limits.fiber} g fibre — WHO / ICMR-NIN reference values for an average adult.
      </p>
    </div>
  );
}
