import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ArrowRight, Eye, EyeOff, Loader2, Lock, Mail, ScanLine, ShieldCheck, Sparkles, UserRound, Zap } from 'lucide-react';
import { api } from '../lib/api';
import DevMailbox from '../components/DevMailbox';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { BrandMark } from '../components/Layout';
import { Button, CheckPill, Field, Input } from '../components/ui';
import { cn } from '../lib/utils';
import { ScoreRing } from '../components/ScoreRing';

const CONDITION_CHIPS = [
  { id: 'diabetes', label: 'Diabetes / pre-diabetes' },
  { id: 'obesity', label: 'Overweight / obesity' },
  { id: 'hypertension', label: 'High blood pressure' },
  { id: 'heart', label: 'Cholesterol / heart' },
  { id: 'fattyliver', label: 'Fatty liver' },
  { id: 'pcos', label: 'PCOS' },
  { id: 'cancer', label: 'Cancer risk' },
  { id: 'gut', label: 'IBS / gut' },
];

const DEMO = { email: 'demo@nutrilens.app', password: 'demo1234' };

function GoogleMark() {
  return (
    <svg viewBox="0 0 24 24" width={16} height={16} aria-hidden>
      <path fill="#4285F4" d="M23.5 12.3c0-.9-.1-1.5-.2-2.2H12v4.2h6.5c-.1 1.1-.8 2.7-2.3 3.8l3.6 2.8c2.1-2 3.7-4.9 3.7-8.6Z" />
      <path fill="#34A853" d="M12 24c3.1 0 5.7-1 7.6-2.9l-3.6-2.8c-1 .7-2.3 1.2-4 1.2-3 0-5.6-2-6.5-4.8l-3.7 2.9C3.7 21.3 7.6 24 12 24Z" />
      <path fill="#FBBC05" d="M5.5 14.7A7.4 7.4 0 0 1 5.1 12c0-.9.2-1.8.4-2.7L1.8 6.4A11.9 11.9 0 0 0 .5 12c0 1.9.5 3.8 1.3 5.6l3.7-2.9Z" />
      <path fill="#EA4335" d="M12 4.8c2.1 0 3.6.9 4.4 1.7l3.2-3.1C17.7 1.6 15.1.5 12 .5 7.6.5 3.7 3.2 1.8 6.4l3.7 2.9C6.4 6.5 9 4.8 12 4.8Z" />
    </svg>
  );
}

export default function Login() {
  const { login, register, adoptToken } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const location = useLocation() as { state?: { from?: string } };

  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [conditions, setConditions] = useState<string[]>(['diabetes']);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [demoLoading, setDemoLoading] = useState(false);
  const [oauth, setOauth] = useState<{ key: string; label: string; configured: boolean }[]>([]);
  const [oauthLoading, setOauthLoading] = useState<string | null>(null);

  useEffect(() => {
    api.auth
      .oauthProviders()
      .then((res) => setOauth(res.providers))
      .catch(() => setOauth([]));
  }, []);

  const oauthSignIn = async (provider: { key: string; label: string; configured: boolean }) => {
    setError(null);
    if (provider.configured) {
      window.location.href = api.auth.oauthStartUrl(provider.key);
      return;
    }
    setOauthLoading(provider.key);
    try {
      const res = await api.auth.oauthDemo(provider.key);
      await adoptToken(res.token);
      toast.success(`Signed in as ${res.user.name}`, res.message);
      go();
    } catch (err: any) {
      setError(err?.message || `Could not sign in with ${provider.label}.`);
    } finally {
      setOauthLoading(null);
    }
  };

  const go = () => navigate(location.state?.from && location.state.from !== '/login' ? location.state.from : '/', { replace: true });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!email.trim() || !password.trim()) {
      setError('Enter your email and password.');
      return;
    }
    if (mode === 'register' && name.trim().length < 2) {
      setError('Tell us your name so the dashboard feels like yours.');
      return;
    }
    setLoading(true);
    try {
      if (mode === 'login') {
        const user = await login(email.trim(), password);
        toast.success(`Welcome back, ${user.name.split(' ')[0]}`, 'Your pantry, logs and scan history are ready.');
      } else {
        const res = await register({
          name: name.trim(),
          email: email.trim(),
          password,
          conditions,
          activity: 'moderate',
        });
        toast.success(
          `Welcome, ${res.user.name.split(' ')[0]}`,
          res.verification?.sent
            ? 'Confirmation email sent — open the dev mailbox on the sign-in screen to confirm it.'
            : 'Start by scanning a nutrition label you have at home.'
        );
      }
      go();
    } catch (err: any) {
      setError(err?.message || 'Something went wrong. Try again.');
    } finally {
      setLoading(false);
    }
  };

  const useDemo = async () => {
    setError(null);
    setDemoLoading(true);
    try {
      await login(DEMO.email, DEMO.password);
      toast.success('Signed in to the demo account', '16 scans, 20 logged meals and a full pantry are waiting.');
      go();
    } catch (err: any) {
      setError(err?.message || 'Could not sign in to the demo account.');
    } finally {
      setDemoLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-[#f4f7f5]">
      {/* ---------------------------------------------------------- left panel */}
      <div className="relative hidden w-[46%] flex-col justify-between overflow-hidden bg-ink-950 p-10 lg:flex xl:p-14">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(90%_55%_at_10%_0%,rgba(16,185,129,.22),transparent_60%),radial-gradient(70%_50%_at_90%_100%,rgba(163,230,53,.14),transparent_60%)]" />
        <div className="relative">
          <div className="flex items-center gap-3">
            <BrandMark size={40} />
            <div>
              <p className="font-display text-[19px] font-bold tracking-tight text-white">NutriLens</p>
              <p className="text-[11.5px] text-white/40">Label intelligence for humans</p>
            </div>
          </div>

          <h1 className="mt-14 max-w-md font-display text-[34px] font-bold leading-[1.12] tracking-tight text-white xl:text-[40px]">
            Everyone reads the calories.
            <span className="block bg-gradient-to-r from-brand-300 to-lime-300 bg-clip-text text-transparent">Almost nobody reads the consequences.</span>
          </h1>
          <p className="mt-5 max-w-md text-[14.5px] leading-relaxed text-white/55">
            Scan any nutrition table — NutriLens decodes what each ingredient does to your body over months and years,
            how much of it your body can actually handle in a day, and what to eat instead.
          </p>

          <ul className="mt-8 space-y-3.5">
            {[
              { icon: ScanLine, title: 'Paste, scan or type a label', text: 'Nutrition table plus ingredients — we parse both.' },
              { icon: Zap, title: 'Long-term consequences, in plain words', text: 'Blood sugar, blood pressure, liver fat, additives.' },
              { icon: ShieldCheck, title: 'Personalised to your conditions', text: 'Diabetes, obesity, hypertension and more.' },
            ].map((item) => (
              <li key={item.title} className="flex items-start gap-3">
                <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/[0.07] text-brand-300 ring-1 ring-inset ring-white/10">
                  <item.icon size={15} />
                </span>
                <div>
                  <p className="text-[13.5px] font-semibold text-white/90">{item.title}</p>
                  <p className="text-[12.5px] text-white/45">{item.text}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        {/* floating sample card */}
        <div className="relative mt-10 rounded-2xl border border-white/10 bg-white/[0.06] p-4 backdrop-blur-sm">
          <div className="flex items-center gap-4">
            <div className="rounded-2xl bg-white p-2 shadow-lg">
              <ScoreRing score={78} size={84} stroke={8} animate={false} label="risk" />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-medium uppercase tracking-wider text-brand-300/80">Sample scan</p>
              <p className="truncate font-display text-[15px] font-semibold text-white">Instant masala noodles · 70 g</p>
              <p className="mt-1 text-[12px] leading-snug text-white/50">
                1,180 mg sodium per serving — 59% of your daily limit. Habitual use pushes blood pressure up
                silently over years.
              </p>
              <div className="mt-2 flex gap-1.5">
                <span className="rounded-md bg-red-400/15 px-1.5 py-0.5 text-[10px] font-semibold text-red-300">MSG</span>
                <span className="rounded-md bg-amber-400/15 px-1.5 py-0.5 text-[10px] font-semibold text-amber-300">Palm oil</span>
                <span className="rounded-md bg-amber-400/15 px-1.5 py-0.5 text-[10px] font-semibold text-amber-300">Caramel colour</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* --------------------------------------------------------- form panel */}
      <div className="flex w-full flex-1 items-center justify-center px-4 py-10 sm:px-8">
        <div className="w-full max-w-[420px]">
          <div className="mb-7 flex items-center gap-3 lg:hidden">
            <BrandMark size={38} />
            <div>
              <p className="font-display text-[17px] font-bold tracking-tight text-ink-900">NutriLens</p>
              <p className="text-[11px] text-ink-400">See what your food does</p>
            </div>
          </div>

          <div className="mb-6 inline-flex rounded-xl border border-ink-200 bg-white p-1 shadow-sm">
            {(['login', 'register'] as const).map((m) => (
              <button
                key={m}
                onClick={() => {
                  setMode(m);
                  setError(null);
                }}
                className={cn(
                  'rounded-lg px-4 py-1.5 text-[13px] font-semibold transition',
                  mode === m ? 'bg-ink-950 text-white shadow-sm' : 'text-ink-500 hover:text-ink-800'
                )}
              >
                {m === 'login' ? 'Sign in' : 'Create account'}
              </button>
            ))}
          </div>

          <h2 className="font-display text-[26px] font-bold tracking-tight text-ink-900">
            {mode === 'login' ? 'Welcome back' : 'Start reading your food'}
          </h2>
          <p className="mt-1.5 text-[13.5px] text-ink-500">
            {mode === 'login' ? 'Your scans and daily budgets are where you left them.' : 'Free, private, and built around your health conditions.'}
          </p>

          <form onSubmit={submit} className="mt-6 space-y-4">
            {mode === 'register' && (
              <Field label="Your name">
                <div className="relative">
                  <UserRound size={15} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-400" />
                  <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Aarav Mehta" className="pl-9" autoComplete="name" />
                </div>
              </Field>
            )}

            <Field label="Email">
              <div className="relative">
                <Mail size={15} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-400" />
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="pl-9"
                  autoComplete="email"
                />
              </div>
            </Field>

            <Field label="Password" hint={mode === 'register' ? 'At least 6 characters.' : undefined}>
              <div className="relative">
                <Lock size={15} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-400" />
                <Input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="pl-9 pr-10"
                  autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((s) => !s)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-md p-1 text-ink-400 hover:bg-ink-100 hover:text-ink-600"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </Field>

            {mode === 'login' && (
              <div className="-mt-1 text-right">
                <Link
                  to="/forgot"
                  className="text-[12px] font-semibold text-brand-700 underline decoration-brand-300 underline-offset-2 hover:text-brand-800"
                >
                  Forgot your password?
                </Link>
              </div>
            )}

            {mode === 'register' && (
              <Field label="What are you managing?" hint="Select any that apply — every scan is scored against them.">
                <div className="flex flex-wrap gap-1.5">
                  {CONDITION_CHIPS.map((c) => (
                    <CheckPill
                      key={c.id}
                      active={conditions.includes(c.id)}
                      onClick={() => setConditions((prev) => (prev.includes(c.id) ? prev.filter((x) => x !== c.id) : [...prev, c.id]))}
                    >
                      {c.label}
                    </CheckPill>
                  ))}
                </div>
              </Field>
            )}

            {error && (
              <div className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-[13px] font-medium text-red-700">{error}</div>
            )}

            <Button type="submit" size="lg" block loading={loading} iconRight={ArrowRight}>
              {mode === 'login' ? 'Sign in' : 'Create my account'}
            </Button>
          </form>

          <div className="my-5 flex items-center gap-3">
            <div className="h-px flex-1 bg-ink-200" />
            <span className="text-[11px] font-medium uppercase tracking-wider text-ink-400">or</span>
            <div className="h-px flex-1 bg-ink-200" />
          </div>

          {oauth.map((p) => (
            <button
              key={p.key}
              onClick={() => oauthSignIn(p)}
              disabled={oauthLoading === p.key}
              className="mb-2.5 flex w-full items-center gap-3 rounded-xl border border-ink-200 bg-white px-3.5 py-2.5 text-left shadow-sm transition hover:border-ink-300 hover:bg-ink-50 disabled:opacity-70"
            >
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-white ring-1 ring-inset ring-ink-200">
                {oauthLoading === p.key ? <Loader2 size={14} className="animate-spin text-ink-400" /> : <GoogleMark />}
              </span>
              <span className="flex-1">
                <span className="block text-[13px] font-semibold text-ink-900">Continue with {p.label}</span>
                {!p.configured && (
                  <span className="block text-[11px] text-ink-400">Demo mode — no {p.label} credentials on this server</span>
                )}
              </span>
              <ArrowRight size={14} className="text-ink-300" />
            </button>
          ))}

          <button
            onClick={useDemo}
            disabled={demoLoading}
            className="group flex w-full items-center gap-3 rounded-xl border border-ink-200 bg-white p-3 text-left shadow-sm transition hover:border-brand-300 hover:bg-brand-50/40 disabled:opacity-70"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-brand-500 to-lime-400 text-white">
              {demoLoading ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
            </span>
            <span className="flex-1">
              <span className="block text-[13px] font-semibold text-ink-900">Explore the demo account</span>
              <span className="block text-[12px] text-ink-500">demo@nutrilens.app · demo1234</span>
            </span>
            <ArrowRight size={15} className="text-ink-300 transition group-hover:translate-x-0.5 group-hover:text-brand-600" />
          </button>

          <div className="mt-5">
            <DevMailbox defaultOpen={mode === 'login' && (location.state as any)?.showMailbox === true} />
          </div>

          <p className="mt-6 text-center text-[11.5px] leading-relaxed text-ink-400">
            NutriLens gives educational guidance based on WHO and ICMR-NIN reference values. It is not medical advice.
          </p>
        </div>
      </div>
    </div>
  );
}
