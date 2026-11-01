import { useEffect, useState } from 'react';
import { cn, toneForScore, TONE_STROKE, verdictLabel } from '../lib/utils';
import type { Tone } from '../lib/types';

export function ScoreRing({
  score,
  size = 132,
  stroke = 11,
  label,
  sublabel,
  tone,
  animate = true,
  className,
}: {
  score: number;
  size?: number;
  stroke?: number;
  label?: string;
  sublabel?: string;
  tone?: Tone;
  animate?: boolean;
  className?: string;
}) {
  const resolved = tone || toneForScore(score);
  const color = TONE_STROKE[resolved];
  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  const [progress, setProgress] = useState(animate ? 0 : score);

  useEffect(() => {
    if (!animate) {
      setProgress(score);
      return;
    }
    const id = requestAnimationFrame(() => setProgress(score));
    return () => cancelAnimationFrame(id);
  }, [score, animate]);

  const offset = circumference - (Math.max(0, Math.min(100, progress)) / 100) * circumference;

  return (
    <div className={cn('relative inline-flex items-center justify-center', className)} style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#eef2f0" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset 1.1s cubic-bezier(.16,1,.3,1)' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        <span className="font-display font-bold tabular-nums leading-none text-ink-900" style={{ fontSize: size * 0.3 }}>
          {Math.round(score)}
        </span>
        <span className="mt-0.5 text-[10px] font-medium uppercase tracking-wider text-ink-400">{label || 'risk score'}</span>
        {sublabel !== undefined && <span className="mt-1 text-[11px] font-medium text-ink-500">{sublabel}</span>}
      </div>
    </div>
  );
}

export function ScoreRingCard({ score, className }: { score: number; className?: string }) {
  const tone = toneForScore(score);
  return (
    <div className={cn('flex flex-col items-center gap-2', className)}>
      <ScoreRing score={score} size={112} stroke={9} />
      <span className={cn('text-[13px] font-semibold', tone === 'red' ? 'text-red-600' : tone === 'orange' ? 'text-orange-600' : tone === 'amber' ? 'text-amber-600' : tone === 'lime' ? 'text-lime-600' : 'text-emerald-600')}>
        {verdictLabel(score)}
      </span>
    </div>
  );
}
