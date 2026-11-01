import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowRight, CheckCircle2, Eye, EyeOff, Lock } from 'lucide-react';
import AuthShell from '../components/AuthShell';
import { Button, Field, Input } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { api } from '../lib/api';

export default function ResetPassword() {
  const [params] = useSearchParams();
  const token = params.get('token') || '';
  const navigate = useNavigate();
  const toast = useToast();
  const { adoptToken } = useAuth();

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [show, setShow] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const strength = (() => {
    let s = 0;
    if (password.length >= 6) s++;
    if (password.length >= 10) s++;
    if (/[A-Z]/.test(password) && /[a-z]/.test(password)) s++;
    if (/\d/.test(password) || /[^A-Za-z0-9]/.test(password)) s++;
    return s; // 0..4
  })();

  if (!token) {
    return (
      <AuthShell title="That link is incomplete" subtitle="It is missing its reset code, which usually happens when an email is forwarded or a URL gets cut off.">
        <Link
          to="/forgot"
          className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-brand-600 px-4 py-2.5 text-[13.5px] font-semibold text-white transition hover:bg-brand-700"
        >
          Request a new link <ArrowRight size={15} />
        </Link>
      </AuthShell>
    );
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    if (password !== confirm) {
      setError('The two passwords do not match.');
      return;
    }
    setLoading(true);
    try {
      const res = await api.auth.resetPassword(token, password);
      await adoptToken(res.token);
      setDone(true);
      toast.success('Password updated', 'You are signed in with the new password.');
      window.setTimeout(() => navigate('/', { replace: true }), 900);
    } catch (err: any) {
      setError(err?.message || 'Could not reset the password. Request a new link.');
    } finally {
      setLoading(false);
    }
  };

  if (done) {
    return (
      <AuthShell title="Password updated" subtitle="Everything is signed in and ready — taking you to your dashboard.">
        <div className="flex items-center gap-2.5 rounded-xl border border-brand-200 bg-brand-50 px-3.5 py-3 text-[13px] font-medium text-brand-900">
          <CheckCircle2 size={16} className="text-brand-600" /> Redirecting…
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell title="Choose a new password" subtitle="This link works once and expires an hour after it was sent.">
      <form onSubmit={submit} className="space-y-4">
        <Field label="New password" hint="At least 6 characters. Longer is stronger.">
          <div className="relative">
            <Lock size={15} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-400" />
            <Input
              type={show ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="pl-9 pr-10"
              autoComplete="new-password"
              autoFocus
            />
            <button
              type="button"
              onClick={() => setShow((s) => !s)}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-md p-1 text-ink-400 hover:bg-ink-100 hover:text-ink-600"
              aria-label={show ? 'Hide password' : 'Show password'}
            >
              {show ? <EyeOff size={15} /> : <Eye size={15} />}
            </button>
          </div>
        </Field>

        {password.length > 0 && (
          <div className="flex gap-1" aria-hidden>
            {[0, 1, 2, 3].map((i) => (
              <span
                key={i}
                className={`h-1 flex-1 rounded-full transition ${
                  i < strength ? (strength <= 2 ? 'bg-amber-400' : 'bg-brand-500') : 'bg-ink-200'
                }`}
              />
            ))}
          </div>
        )}

        <Field label="Confirm new password">
          <div className="relative">
            <Lock size={15} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-400" />
            <Input
              type={show ? 'text' : 'password'}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="••••••••"
              className="pl-9"
              autoComplete="new-password"
              invalid={Boolean(confirm) && confirm !== password}
            />
          </div>
        </Field>

        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-[13px] font-medium text-red-700">
            {error}
          </div>
        )}

        <Button type="submit" size="lg" block loading={loading} iconRight={ArrowRight}>
          Save new password
        </Button>

        <p className="text-center text-[11.5px] text-ink-400">
          Expired? <Link to="/forgot" className="font-semibold text-brand-700 underline decoration-brand-300 underline-offset-2">Request a fresh link</Link>.
        </p>
      </form>
    </AuthShell>
  );
}
