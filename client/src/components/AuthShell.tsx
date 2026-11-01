import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { BrandMark } from './Layout';

/** Shared chrome for the signed-out screens (confirm email, reset, OAuth). */
export default function AuthShell({
  title,
  subtitle,
  children,
  footer,
  backTo = '/login',
  backLabel = 'Back to sign in',
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
  backTo?: string | null;
  backLabel?: string;
}) {
  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-[#f4f7f5] px-4 py-10">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_45%_at_50%_0%,rgba(16,185,129,.14),transparent_65%),radial-gradient(50%_40%_at_85%_95%,rgba(163,230,53,.12),transparent_60%)]" />

      <div className="relative w-full max-w-[460px]">
        <Link to="/login" className="mb-6 flex items-center gap-3">
          <BrandMark size={38} />
          <div>
            <p className="font-display text-[17px] font-bold tracking-tight text-ink-900">NutriLens</p>
            <p className="text-[11px] text-ink-400">See what your food does</p>
          </div>
        </Link>

        <div className="rounded-3xl border border-ink-200 bg-white p-6 shadow-[0_18px_50px_-30px_rgba(6,32,26,.35)] sm:p-7">
          <h1 className="font-display text-[23px] font-bold leading-tight tracking-tight text-ink-900">{title}</h1>
          {subtitle && <p className="mt-2 text-[13.5px] leading-relaxed text-ink-500">{subtitle}</p>}
          <div className="mt-5">{children}</div>
        </div>

        {footer && <div className="mt-4">{footer}</div>}

        {backTo && (
          <Link
            to={backTo}
            className="mt-5 inline-flex items-center gap-1.5 text-[12.5px] font-medium text-ink-500 transition hover:text-ink-800"
          >
            <ArrowLeft size={13} /> {backLabel}
          </Link>
        )}

        <p className="mt-6 text-center text-[11px] leading-relaxed text-ink-400">
          NutriLens is an educational tool, not a medical device. It never shares your health data with anyone.
        </p>
      </div>
    </div>
  );
}
