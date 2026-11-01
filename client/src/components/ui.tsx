import { forwardRef, useEffect } from 'react';
import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react';
import { createPortal } from 'react-dom';
import { AlertCircle, Check, Loader2, X } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { cn, toneForScore, TONE_CHIP, TONE_SOLID, clamp } from '../lib/utils';
import type { Tone } from '../lib/types';

/* ------------------------------------------------------------------ Button */
type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'dark';
type Size = 'sm' | 'md' | 'lg';

const VARIANTS: Record<Variant, string> = {
  primary:
    'bg-brand-600 text-white shadow-sm hover:bg-brand-700 active:bg-brand-800 focus-visible:ring-brand-500/40 disabled:bg-brand-300',
  secondary:
    'bg-white text-ink-700 border border-ink-200 shadow-sm hover:bg-ink-50 hover:border-ink-300 active:bg-ink-100 focus-visible:ring-ink-300/50 disabled:text-ink-400',
  ghost: 'text-ink-600 hover:bg-ink-100 hover:text-ink-900 active:bg-ink-200 focus-visible:ring-ink-300/50',
  danger: 'bg-red-600 text-white shadow-sm hover:bg-red-700 active:bg-red-800 focus-visible:ring-red-500/40 disabled:bg-red-300',
  dark: 'bg-ink-950 text-white shadow-sm hover:bg-ink-900 active:bg-ink-800 focus-visible:ring-ink-500/40 disabled:bg-ink-600',
};

const SIZES: Record<Size, string> = {
  sm: 'h-8.5 px-3 text-[13px] gap-1.5 rounded-lg',
  md: 'h-10 px-4 text-sm gap-2 rounded-xl',
  lg: 'h-12 px-5 text-[15px] gap-2 rounded-xl',
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  icon?: LucideIcon;
  iconRight?: LucideIcon;
  block?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', size = 'md', loading, icon: Icon, iconRight: IconRight, block, className, children, disabled, ...rest },
  ref
) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={cn(
        'inline-flex select-none items-center justify-center font-semibold transition-all outline-none focus-visible:ring-4 disabled:cursor-not-allowed',
        VARIANTS[variant],
        SIZES[size],
        block && 'w-full',
        className
      )}
      {...rest}
    >
      {loading ? <Loader2 className="animate-spin" size={16} /> : Icon ? <Icon size={16} /> : null}
      {children}
      {IconRight && !loading && <IconRight size={16} />}
    </button>
  );
});

/* -------------------------------------------------------------------- Card */
export function Card({ className, children, ...rest }: { className?: string; children: ReactNode } & React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('card', className)} {...rest}>
      {children}
    </div>
  );
}

export function CardHeader({
  title,
  subtitle,
  action,
  icon: Icon,
  className,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  action?: ReactNode;
  icon?: LucideIcon;
  className?: string;
}) {
  return (
    <div className={cn('flex items-start justify-between gap-3 border-b border-ink-100 px-5 py-4 sm:px-6', className)}>
      <div className="flex items-start gap-3">
        {Icon && (
          <span className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
            <Icon size={16} />
          </span>
        )}
        <div>
          <h3 className="text-[15px] font-semibold tracking-tight text-ink-900">{title}</h3>
          {subtitle && <p className="mt-0.5 text-[13px] leading-snug text-ink-500">{subtitle}</p>}
        </div>
      </div>
      {action}
    </div>
  );
}

/* ------------------------------------------------------------------- Chips */
export function Chip({ tone = 'slate', children, className, icon: Icon }: { tone?: Tone; children: ReactNode; className?: string; icon?: LucideIcon }) {
  return (
    <span className={cn('chip', TONE_CHIP[tone], className)}>
      {Icon && <Icon size={12} />}
      {children}
    </span>
  );
}

export function ScoreChip({ score, className, showLabel }: { score: number; className?: string; showLabel?: boolean }) {
  const tone = toneForScore(score);
  return (
    <span className={cn('chip', TONE_CHIP[tone], className)}>
      <span className={cn('h-1.5 w-1.5 rounded-full', TONE_SOLID[tone])} />
      {score}
      {showLabel && <span className="font-normal opacity-80">/100</span>}
    </span>
  );
}

/* ------------------------------------------------------------------ Fields */
export function Field({
  label,
  hint,
  error,
  children,
  className,
  htmlFor,
}: {
  label?: ReactNode;
  hint?: ReactNode;
  error?: string | null;
  children: ReactNode;
  className?: string;
  htmlFor?: string;
}) {
  return (
    <div className={className}>
      {label && (
        <label className="label" htmlFor={htmlFor}>
          {label}
        </label>
      )}
      {children}
      {error ? (
        <p className="mt-1.5 flex items-center gap-1 text-xs font-medium text-red-600">
          <AlertCircle size={12} /> {error}
        </p>
      ) : hint ? (
        <p className="mt-1.5 text-xs leading-snug text-ink-400">{hint}</p>
      ) : null}
    </div>
  );
}

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean }>(function Input(
  { className, invalid, ...rest },
  ref
) {
  return <input ref={ref} className={cn('input', invalid && 'input-error', className)} {...rest} />;
});

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(function Textarea({ className, ...rest }, ref) {
  return <textarea ref={ref} className={cn('input min-h-[92px] resize-y leading-relaxed', className)} {...rest} />;
});

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(function Select({ className, children, ...rest }, ref) {
  return (
    <select
      ref={ref}
      className={cn(
        'input appearance-none bg-[url("data:image/svg+xml;charset=utf-8,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'14\' height=\'14\' viewBox=\'0 0 24 24\' fill=\'none\' stroke=\'%237f9a90\' stroke-width=\'2.5\' stroke-linecap=\'round\' stroke-linejoin=\'round\'%3E%3Cpath d=\'m6 9 6 6 6-6\'/%3E%3C/svg%3E")] bg-[right_0.75rem_center] bg-no-repeat pr-9',
        className
      )}
      {...rest}
    >
      {children}
    </select>
  );
});

export function NumberField({
  label,
  value,
  onChange,
  unit,
  step = 1,
  placeholder,
  hint,
  max,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  unit: string;
  step?: number;
  placeholder?: string;
  hint?: string;
  max?: number;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[12px] font-medium text-ink-600">{label}</span>
      <div className="relative">
        <input
          type="number"
          inputMode="decimal"
          min={0}
          max={max}
          step={step}
          value={Number.isFinite(value) && value !== 0 ? value : value === 0 ? '' : ''}
          placeholder={placeholder || '0'}
          onChange={(e) => onChange(e.target.value === '' ? 0 : Math.max(0, Number(e.target.value)))}
          className="input pr-12 tabular-nums"
        />
        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[11px] font-medium text-ink-400">{unit}</span>
      </div>
      {hint && <span className="mt-1 block text-[11px] text-ink-400">{hint}</span>}
    </label>
  );
}

/* ------------------------------------------------------------------- Modal */
export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = 'md',
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  size?: 'sm' | 'md' | 'lg';
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;
  const width = size === 'sm' ? 'max-w-md' : size === 'lg' ? 'max-w-3xl' : 'max-w-xl';

  return createPortal(
    <div className="fixed inset-0 z-[70] flex items-end justify-center p-0 sm:items-center sm:p-6">
      <div className="absolute inset-0 bg-ink-950/45 backdrop-blur-[3px]" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        className={cn(
          'relative z-10 flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-3xl bg-white shadow-lift animate-fade-up sm:rounded-2xl',
          width
        )}
      >
        <div className="flex items-start justify-between gap-4 border-b border-ink-100 px-5 py-4">
          <div>
            <h2 className="text-base font-semibold tracking-tight text-ink-900">{title}</h2>
            {description && <p className="mt-0.5 text-[13px] text-ink-500">{description}</p>}
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-ink-400 transition hover:bg-ink-100 hover:text-ink-700" aria-label="Close">
            <X size={18} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-5">{children}</div>
        {footer && <div className="flex items-center justify-end gap-2 border-t border-ink-100 bg-ink-50/60 px-5 py-3.5">{footer}</div>}
      </div>
    </div>,
    document.body
  );
}

/* -------------------------------------------------------------- EmptyState */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  tone = 'brand',
  compact,
}: {
  icon: LucideIcon;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  tone?: 'brand' | 'ink';
  compact?: boolean;
}) {
  return (
    <div className={cn('flex flex-col items-center justify-center text-center', compact ? 'px-4 py-8' : 'px-6 py-14')}>
      <div
        className={cn(
          'mb-4 flex items-center justify-center rounded-2xl ring-1',
          compact ? 'h-11 w-11' : 'h-14 w-14',
          tone === 'brand' ? 'bg-brand-50 text-brand-600 ring-brand-100' : 'bg-ink-50 text-ink-400 ring-ink-100'
        )}
      >
        <Icon size={compact ? 20 : 24} />
      </div>
      <h3 className="text-[15px] font-semibold text-ink-900">{title}</h3>
      {description && <p className="mt-1.5 max-w-sm text-[13px] leading-relaxed text-ink-500">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

/* --------------------------------------------------------------- Skeletons */
export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('skeleton', className)} />;
}

export function SkeletonCard({ rows = 3, className }: { rows?: number; className?: string }) {
  return (
    <div className={cn('card card-pad', className)}>
      <Skeleton className="h-4 w-1/3" />
      <div className="mt-4 space-y-2.5">
        {Array.from({ length: rows }).map((_, i) => (
          <Skeleton key={i} className={cn('h-3', i % 3 === 0 ? 'w-full' : i % 3 === 1 ? 'w-5/6' : 'w-2/3')} />
        ))}
      </div>
    </div>
  );
}

/* --------------------------------------------------------------- Progress */
export function Progress({
  value,
  max = 100,
  tone,
  size = 'md',
  className,
  invert,
}: {
  value: number;
  max?: number;
  tone?: Tone;
  size?: 'sm' | 'md';
  className?: string;
  invert?: boolean;
}) {
  const raw = max > 0 ? (value / max) * 100 : 0;
  const width = clamp(raw, 0, 100);
  const autoTone: Tone = invert ? 'emerald' : raw > 100 ? 'red' : raw > 75 ? 'orange' : raw > 50 ? 'amber' : 'emerald';
  const resolved = tone || autoTone;
  return (
    <div className={cn('w-full overflow-hidden rounded-full bg-ink-100', size === 'sm' ? 'h-1.5' : 'h-2.5', className)}>
      <div
        className={cn('h-full rounded-full transition-[width] duration-700 ease-out', TONE_SOLID[resolved])}
        style={{ width: `${width}%` }}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ Misc */
export function Switch({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label?: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={cn(
        'relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors',
        checked ? 'bg-brand-600' : 'bg-ink-200'
      )}
    >
      <span className={cn('inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform', checked ? 'translate-x-5' : 'translate-x-0.5')} />
    </button>
  );
}

export function CheckPill({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[13px] font-medium ring-1 transition',
        active
          ? 'bg-brand-600 text-white ring-brand-600 shadow-sm'
          : 'bg-white text-ink-600 ring-ink-200 hover:border-ink-300 hover:bg-ink-50'
      )}
    >
      {active && <Check size={12} />}
      {children}
    </button>
  );
}

export function SectionTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-3 flex items-end justify-between gap-3">
      <h2 className="font-display text-[17px] font-semibold tracking-tight text-ink-900">{children}</h2>
      {action}
    </div>
  );
}
