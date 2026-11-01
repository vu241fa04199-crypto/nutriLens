import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Line, Pie, PieChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis, ReferenceLine, ComposedChart,
} from 'recharts';
import { toneForScore, TONE_STROKE, cn } from '../lib/utils';

const AXIS = { fontSize: 11, fill: '#7f9a90' } as const;

function TipBox({ title, rows }: { title: string; rows: { label: string; value: string; color?: string }[] }) {
  return (
    <div className="rounded-xl border border-ink-100 bg-white/95 px-3 py-2 shadow-lift backdrop-blur">
      <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-ink-400">{title}</p>
      {rows.map((r) => (
        <p key={r.label} className="flex items-center gap-1.5 text-xs text-ink-700">
          {r.color && <span className="h-1.5 w-1.5 rounded-full" style={{ background: r.color }} />}
          <span className="text-ink-500">{r.label}</span>
          <span className="font-semibold tabular-nums">{r.value}</span>
        </p>
      ))}
    </div>
  );
}

export function RiskTrendChart({ data, className }: { data: { label: string; avgScore: number | null; count: number }[]; className?: string }) {
  const hasData = data.some((d) => d.avgScore != null);
  if (!hasData) return null;
  return (
    <div className={cn('h-[220px] w-full', className)}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, left: -6, bottom: 0 }}>
          <defs>
            <linearGradient id="riskFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#f59e0b" stopOpacity={0.35} />
              <stop offset="60%" stopColor="#f59e0b" stopOpacity={0.08} />
              <stop offset="100%" stopColor="#f59e0b" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 6" stroke="#eef2f0" vertical={false} />
          <XAxis dataKey="label" tick={AXIS} tickLine={false} axisLine={false} interval="preserveStartEnd" minTickGap={22} />
          <YAxis domain={[0, 100]} tick={AXIS} tickLine={false} axisLine={false} width={34} />
          <Tooltip
            cursor={{ stroke: '#d3ddd9', strokeWidth: 1 }}
            content={({ active, payload, label }) => {
              if (!active || !payload?.length) return null;
              const p: any = payload[0]?.payload;
              return (
                <TipBox
                  title={String(label)}
                  rows={[
                    { label: 'Avg risk', value: p?.avgScore != null ? `${p.avgScore}/100` : '—', color: p?.avgScore != null ? TONE_STROKE[toneForScore(p.avgScore)] : undefined },
                    { label: 'Scans', value: String(p?.count ?? 0) },
                  ]}
                />
              );
            }}
          />
          <ReferenceLine y={40} stroke="#bbf7d0" strokeDasharray="4 4" />
          <ReferenceLine y={70} stroke="#fecaca" strokeDasharray="4 4" />
          <Area
            type="monotone"
            dataKey="avgScore"
            stroke="#f59e0b"
            strokeWidth={2.5}
            fill="url(#riskFill)"
            connectNulls
            dot={{ r: 3, strokeWidth: 2, fill: '#fff', stroke: '#f59e0b' }}
            activeDot={{ r: 5, strokeWidth: 2, fill: '#fff', stroke: '#f59e0b' }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export function WeekSugarChart({ data, limit = 50 }: { data: { label: string; sugar: number }[]; limit?: number }) {
  return (
    <div className="h-[170px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 6, right: 6, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 6" stroke="#eef2f0" vertical={false} />
          <XAxis dataKey="label" tick={AXIS} tickLine={false} axisLine={false} />
          <YAxis tick={AXIS} tickLine={false} axisLine={false} width={34} />
          <Tooltip
            cursor={{ fill: 'rgba(16,185,129,0.06)' }}
            content={({ active, payload, label }) => {
              if (!active || !payload?.length) return null;
              const v = Number(payload[0]?.value || 0);
              return <TipBox title={String(label)} rows={[{ label: 'Sugar', value: `${v} g`, color: v > limit ? '#ef4444' : '#10b981' }, { label: 'Daily cap', value: `${limit} g` }]} />;
            }}
          />
          <ReferenceLine y={limit} stroke="#fca5a5" strokeDasharray="5 4" />
          <Bar dataKey="sugar" radius={[6, 6, 0, 0]} maxBarSize={30}>
            {data.map((d, i) => (
              <Cell key={i} fill={d.sugar > limit ? '#f87171' : d.sugar > limit * 0.75 ? '#fbbf24' : '#34d399'} />
            ))}
          </Bar>
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

const BUCKET_COLORS: Record<string, string> = {
  everyday: '#10b981',
  moderate: '#84cc16',
  caution: '#f59e0b',
  high: '#f97316',
  avoid: '#ef4444',
};

const BUCKET_LABELS: Record<string, string> = {
  everyday: 'Everyday',
  moderate: 'Moderate',
  caution: 'Occasional',
  high: 'High risk',
  avoid: 'Avoid',
};

export function VerdictDonut({ buckets }: { buckets: Record<string, number> }) {
  const data = Object.entries(buckets)
    .filter(([, v]) => v > 0)
    .map(([key, value]) => ({ key, name: BUCKET_LABELS[key] || key, value }));
  const total = data.reduce((a, b) => a + b.value, 0);

  if (!total) {
    return (
      <div className="flex h-[190px] items-center justify-center text-[13px] text-ink-400">No scans yet</div>
    );
  }

  return (
    <div className="flex items-center gap-4">
      <div className="relative h-[150px] w-[150px] shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={data} dataKey="value" nameKey="name" innerRadius={46} outerRadius={68} paddingAngle={2} stroke="none">
              {data.map((d) => (
                <Cell key={d.key} fill={BUCKET_COLORS[d.key]} />
              ))}
            </Pie>
            <Tooltip content={({ active, payload }) => (active && payload?.length ? <TipBox title={String(payload[0]?.name)} rows={[{ label: 'Scans', value: String(payload[0]?.value) }]} /> : null)} />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="font-display text-2xl font-bold leading-none text-ink-900">{total}</span>
          <span className="text-[10px] font-medium uppercase tracking-wide text-ink-400">scans</span>
        </div>
      </div>
      <ul className="flex-1 space-y-2">
        {data.map((d) => (
          <li key={d.key} className="flex items-center justify-between gap-2 text-[13px]">
            <span className="flex items-center gap-2 text-ink-600">
              <span className="h-2 w-2 rounded-full" style={{ background: BUCKET_COLORS[d.key] }} />
              {d.name}
            </span>
            <span className="font-semibold tabular-nums text-ink-800">{d.value}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function NutrientBars({
  items,
  compact,
}: {
  items: { label: string; value: number; limit: number; unit: string; positive?: boolean }[];
  compact?: boolean;
}) {
  return (
    <div className={cn('space-y-3.5', compact && 'space-y-3')}>
      {items.map((item) => {
        const percent = item.limit > 0 ? Math.round((item.value / item.limit) * 100) : 0;
        const tone = item.positive
          ? percent >= 100
            ? 'bg-emerald-500'
            : percent >= 50
              ? 'bg-lime-500'
              : 'bg-amber-400'
          : percent > 100
            ? 'bg-red-500'
            : percent > 75
              ? 'bg-orange-500'
              : percent > 50
                ? 'bg-amber-400'
                : 'bg-emerald-500';
        return (
          <div key={item.label}>
            <div className="mb-1.5 flex items-baseline justify-between gap-2">
              <span className="text-[13px] font-medium text-ink-700">{item.label}</span>
              <span className="text-[12px] tabular-nums text-ink-500">
                <span className="font-semibold text-ink-800">{Math.round(item.value * 10) / 10}</span>
                <span className="text-ink-400"> / {item.limit} {item.unit}</span>
                <span className={cn('ml-1.5 font-semibold', percent > 100 && !item.positive ? 'text-red-600' : 'text-ink-500')}>{percent}%</span>
              </span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-ink-100">
              <div className={cn('h-full rounded-full transition-[width] duration-700', tone)} style={{ width: `${Math.min(percent, 100)}%` }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function MiniSpark({ data, color = '#10b981' }: { data: number[]; color?: string }) {
  const chart = data.map((v, i) => ({ i, v }));
  return (
    <div className="h-10 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={chart} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id={`spark-${color.replace('#', '')}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.3} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <Area type="monotone" dataKey="v" stroke={color} strokeWidth={2} fill={`url(#spark-${color.replace('#', '')})`} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export { Line };
