import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  Activity, BookOpen, ClipboardList, LayoutDashboard, LogOut, Menu, Package, ScanLine, Sparkles, UserRound, X, HeartPulse,
  ShieldCheck, MailWarning, RefreshCcw, Loader2,
} from 'lucide-react';
import { api } from '../lib/api';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';
import { cn } from '../lib/utils';

const NAV = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/scan', label: 'Scan a label', icon: ScanLine },
  { to: '/pantry', label: 'My pantry', icon: Package },
  { to: '/log', label: 'Daily log', icon: ClipboardList },
  { to: '/learn', label: 'Learn', icon: BookOpen },
  { to: '/profile', label: 'Health profile', icon: UserRound },
];

const CONDITION_SHORT: Record<string, string> = {
  diabetes: 'Diabetes',
  obesity: 'Weight',
  hypertension: 'BP',
  heart: 'Heart',
  fattyliver: 'Fatty liver',
  pcos: 'PCOS',
  kidney: 'Kidney',
  cancer: 'Cancer risk',
  gut: 'Gut',
  gout: 'Gout',
};

export function BrandMark({ className, size = 36 }: { className?: string; size?: number }) {
  return (
    <span
      className={cn('inline-flex items-center justify-center rounded-2xl bg-gradient-to-br from-brand-400 via-brand-500 to-lime-400 text-ink-950 shadow-[0_6px_18px_-6px_rgba(16,185,129,.8)]', className)}
      style={{ width: size, height: size }}
    >
      <svg viewBox="0 0 24 24" width={size * 0.6} height={size * 0.6} fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4.5 12.5 9.5 17.5 19.5 6.5" />
      </svg>
    </span>
  );
}

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const conditions = user?.conditions || [];
  const isDemo = user?.email === 'demo@nutrilens.app';

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-3 px-5 pb-5 pt-6">
        <BrandMark size={38} />
        <div>
          <p className="font-display text-[17px] font-bold leading-tight tracking-tight text-white">NutriLens</p>
          <p className="text-[11px] leading-tight text-ink-300/70">See what your food does</p>
        </div>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-3">
        <p className="px-3 pb-2 pt-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-white/30">Workspace</p>
        {NAV.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            onClick={onNavigate}
            className={({ isActive }) => cn('nav-item', isActive && 'nav-item-active')}
          >
            {({ isActive }) => (
              <>
                <item.icon size={17} className={isActive ? 'text-brand-300' : 'text-white/50'} />
                <span>{item.label}</span>
                {isActive && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-brand-300" />}
              </>
            )}
          </NavLink>
        ))}

        <div className="px-3 pb-2 pt-5">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/30">Health profile</p>
        </div>
        <button
          onClick={() => {
            navigate('/profile');
            onNavigate?.();
          }}
          className="mx-1 w-[calc(100%-0.5rem)] rounded-xl border border-white/10 bg-white/[0.04] p-3 text-left transition hover:bg-white/[0.08]"
        >
          <div className="flex items-center gap-2 text-[12px] font-medium text-white/80">
            <HeartPulse size={13} className="text-brand-300" />
            {conditions.length ? `${conditions.length} condition${conditions.length > 1 ? 's' : ''} tracked` : 'No conditions set'}
          </div>
          <div className="mt-2 flex flex-wrap gap-1">
            {conditions.slice(0, 3).map((c) => (
              <span key={c} className="rounded-md bg-white/10 px-1.5 py-0.5 text-[10px] font-medium text-white/70">
                {CONDITION_SHORT[c] || c}
              </span>
            ))}
            {conditions.length > 3 && (
              <span className="rounded-md bg-white/10 px-1.5 py-0.5 text-[10px] font-medium text-white/70">+{conditions.length - 3}</span>
            )}
            {!conditions.length && <span className="text-[11px] text-white/40">Personalise every scan →</span>}
          </div>
        </button>

        {user?.role === 'admin' && (
          <>
            <div className="px-3 pb-2 pt-5">
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/30">Manage</p>
            </div>
            <NavLink
              to="/admin"
              onClick={onNavigate}
              className={({ isActive }) => cn('nav-item', isActive && 'nav-item-active')}
            >
              {({ isActive }) => (
                <>
                  <ShieldCheck size={17} className={isActive ? 'text-brand-300' : 'text-white/50'} />
                  <span>Admin</span>
                  {isActive && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-brand-300" />}
                </>
              )}
            </NavLink>
          </>
        )}

        <div className="mx-1 mt-3 rounded-xl bg-gradient-to-br from-brand-500/15 to-lime-400/10 p-3 ring-1 ring-inset ring-white/10">
          <p className="flex items-center gap-1.5 text-[12px] font-semibold text-brand-200">
            <Sparkles size={12} /> {isDemo ? 'Demo account' : 'Tip'}
          </p>
          <p className="mt-1 text-[11px] leading-snug text-white/50">
            {isDemo
              ? 'Seeded with a full pantry, 16 scans and a week of food logs so every screen feels alive.'
              : 'Scan a label you have at home, then log it — your daily budget updates instantly.'}
          </p>
        </div>
      </nav>

      <div className="border-t border-white/10 p-3">
        <div className="flex items-center gap-2.5 rounded-xl px-2 py-2">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-400/20 text-[13px] font-bold text-brand-200 ring-1 ring-inset ring-brand-300/30">
            {user?.initials || user?.name?.slice(0, 2).toUpperCase() || 'NL'}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-semibold text-white/90">{user?.name}</p>
            <p className="truncate text-[11px] text-white/40">{user?.email}</p>
          </div>
          <button
            onClick={() => {
              logout();
              navigate('/login');
            }}
            title="Sign out"
            className="rounded-lg p-2 text-white/50 transition hover:bg-white/10 hover:text-white"
          >
            <LogOut size={15} />
          </button>
        </div>
      </div>
    </div>
  );
}

function VerifyBanner() {
  const { user, setUser } = useAuth();
  const toast = useToast();
  const [sending, setSending] = useState(false);
  const [hidden, setHidden] = useState(() => sessionStorage.getItem('nutrilens.verify-dismissed') === '1');

  if (!user || user.emailVerified || hidden) return null;

  const resend = async () => {
    setSending(true);
    try {
      const res = await api.auth.resendVerification();
      toast.success('Confirmation link sent', res.message);
      setUser({ ...user, emailVerified: user.emailVerified });
    } catch (err: any) {
      toast.error('Could not send the link', err?.message || 'Try again in a moment.');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="mb-5 flex flex-col gap-3 rounded-2xl border border-amber-200 bg-amber-50/80 p-3.5 sm:flex-row sm:items-center">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-700 ring-1 ring-inset ring-amber-200">
        <MailWarning size={16} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-semibold text-amber-900">Confirm your email address</p>
        <p className="text-[12px] leading-relaxed text-amber-800/80">
          We sent a link to <span className="font-medium">{user.email}</span>. Everything works without it, but password
          recovery needs a confirmed address.
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <button
          onClick={resend}
          disabled={sending}
          className="inline-flex items-center gap-1.5 rounded-lg bg-amber-600 px-2.5 py-1.5 text-[12px] font-semibold text-white transition hover:bg-amber-700 disabled:opacity-70"
        >
          {sending ? <Loader2 size={12} className="animate-spin" /> : <RefreshCcw size={12} />} Resend
        </button>
        <button
          onClick={() => {
            sessionStorage.setItem('nutrilens.verify-dismissed', '1');
            setHidden(true);
          }}
          className="rounded-lg p-1.5 text-amber-700/70 transition hover:bg-amber-100"
          aria-label="Dismiss"
        >
          <X size={14} />
        </button>
      </div>
    </div>
  );
}

export default function Layout() {
  const [open, setOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    setOpen(false);
  }, [location.pathname]);

  return (
    <div className="min-h-full lg:flex">
      {/* desktop sidebar */}
      <aside className="sticky top-0 hidden h-screen w-[264px] shrink-0 bg-ink-950 lg:block">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_60%_at_0%_0%,rgba(16,185,129,.18),transparent_60%),radial-gradient(90%_50%_at_100%_100%,rgba(163,230,53,.1),transparent_60%)]" />
        <div className="relative h-full">
          <SidebarContent />
        </div>
      </aside>

      {/* mobile drawer */}
      {open && (
        <div className="fixed inset-0 z-[60] lg:hidden">
          <div className="absolute inset-0 bg-ink-950/50 backdrop-blur-sm" onClick={() => setOpen(false)} />
          <div className="relative h-full w-[280px] animate-fade-up bg-ink-950 shadow-lift">
            <button
              onClick={() => setOpen(false)}
              className="absolute right-3 top-4 z-10 rounded-lg p-2 text-white/60 hover:bg-white/10 hover:text-white"
              aria-label="Close menu"
            >
              <X size={18} />
            </button>
            <SidebarContent onNavigate={() => setOpen(false)} />
          </div>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        {/* mobile top bar */}
        <header className="sticky top-0 z-40 flex items-center gap-3 border-b border-ink-100 bg-[#f4f7f5]/90 px-4 py-3 backdrop-blur lg:hidden">
          <button onClick={() => setOpen(true)} className="rounded-xl border border-ink-200 bg-white p-2 text-ink-700 shadow-sm" aria-label="Open menu">
            <Menu size={18} />
          </button>
          <div className="flex items-center gap-2">
            <BrandMark size={28} />
            <span className="font-display text-[15px] font-bold tracking-tight text-ink-900">NutriLens</span>
          </div>
          <NavLink to="/scan" className="ml-auto inline-flex items-center gap-1.5 rounded-xl bg-brand-600 px-3 py-2 text-[13px] font-semibold text-white shadow-sm">
            <ScanLine size={14} /> Scan
          </NavLink>
        </header>

        <main className="mx-auto w-full max-w-[1400px] flex-1 px-4 pb-16 pt-5 sm:px-6 lg:px-8 lg:pt-8">
          <VerifyBanner />
          <Outlet />
        </main>

        <footer className="border-t border-ink-100 px-4 py-5 text-center sm:px-6 lg:px-8">
          <p className="mx-auto max-w-3xl text-[11px] leading-relaxed text-ink-400">
            NutriLens is an educational tool. Scores and portion guidance are based on WHO / ICMR-NIN nutrient reference values and
            front-of-pack profiling thresholds — they are not a medical diagnosis. Talk to a doctor or dietitian before changing your diet,
            especially if you manage a chronic condition.
          </p>
          <p className="mt-2 flex items-center justify-center gap-1.5 text-[11px] text-ink-300">
            <Activity size={11} /> Built for people who read labels.
          </p>
        </footer>
      </div>
    </div>
  );
}
