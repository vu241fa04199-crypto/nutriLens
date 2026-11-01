import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { AlertTriangle, CheckCircle2, Info, X } from 'lucide-react';
import { cn } from '../lib/utils';

type ToastTone = 'success' | 'error' | 'info';

interface Toast {
  id: number;
  title: string;
  description?: string;
  tone: ToastTone;
  action?: { label: string; onClick: () => void };
}

interface ToastContextValue {
  push: (toast: Omit<Toast, 'id'>) => number;
  success: (title: string, description?: string, action?: Toast['action']) => number;
  error: (title: string, description?: string) => number;
  info: (title: string, description?: string) => number;
  dismiss: (id: number) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const ICONS = {
  success: CheckCircle2,
  error: AlertTriangle,
  info: Info,
};

const TONES = {
  success: 'text-emerald-600 bg-emerald-50',
  error: 'text-red-600 bg-red-50',
  info: 'text-sky-600 bg-sky-50',
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const seq = useRef(0);
  const timers = useRef<Record<number, ReturnType<typeof setTimeout>>>({});

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    if (timers.current[id]) {
      clearTimeout(timers.current[id]);
      delete timers.current[id];
    }
  }, []);

  const push = useCallback(
    (toast: Omit<Toast, 'id'>) => {
      const id = ++seq.current;
      setToasts((prev) => [...prev.slice(-3), { ...toast, id }]);
      timers.current[id] = setTimeout(() => dismiss(id), toast.tone === 'error' ? 6000 : 4200);
      return id;
    },
    [dismiss]
  );

  const success = useCallback((title: string, description?: string, action?: Toast['action']) => push({ title, description, tone: 'success', action }), [push]);
  const error = useCallback((title: string, description?: string) => push({ title, description, tone: 'error' }), [push]);
  const info = useCallback((title: string, description?: string) => push({ title, description, tone: 'info' }), [push]);

  const value = useMemo(() => ({ push, success, error, info, dismiss }), [push, success, error, info, dismiss]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-[80] flex flex-col items-center gap-2 p-4 sm:inset-x-auto sm:right-4 sm:items-end">
        {toasts.map((t) => {
          const Icon = ICONS[t.tone];
          return (
            <div
              key={t.id}
              role="status"
              className="pointer-events-auto flex w-full max-w-sm animate-fade-up items-start gap-3 rounded-2xl border border-ink-100 bg-white p-3.5 shadow-lift"
            >
              <span className={cn('mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full', TONES[t.tone])}>
                <Icon className="h-4.5 w-4.5" size={18} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-ink-900">{t.title}</p>
                {t.description && <p className="mt-0.5 text-[13px] leading-snug text-ink-500">{t.description}</p>}
                {t.action && (
                  <button
                    onClick={() => {
                      t.action?.onClick();
                      dismiss(t.id);
                    }}
                    className="mt-2 text-[13px] font-semibold text-brand-700 hover:text-brand-800"
                  >
                    {t.action.label}
                  </button>
                )}
              </div>
              <button
                onClick={() => dismiss(t.id)}
                className="rounded-lg p-1 text-ink-400 transition hover:bg-ink-100 hover:text-ink-600"
                aria-label="Dismiss"
              >
                <X size={15} />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside ToastProvider');
  return ctx;
}
