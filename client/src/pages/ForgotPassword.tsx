import { useState } from 'react';
import { ArrowRight, CheckCircle2, Mail } from 'lucide-react';
import AuthShell from '../components/AuthShell';
import DevMailbox from '../components/DevMailbox';
import { Button, Field, Input } from '../components/ui';
import { api } from '../lib/api';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!email.trim()) {
      setError('Enter the email you signed up with.');
      return;
    }
    setLoading(true);
    try {
      const res = await api.auth.forgotPassword(email.trim());
      setSent(res.message);
    } catch (err: any) {
      setError(err?.message || 'Could not send the reset email. Try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell
      title={sent ? 'Check your inbox' : 'Forgot your password?'}
      subtitle={
        sent
          ? undefined
          : 'Enter your email and we will send a single-use link to choose a new password. It expires in an hour.'
      }
      footer={<DevMailbox defaultOpen={Boolean(sent)} />}
    >
      {sent ? (
        <div className="space-y-4">
          <div className="flex items-start gap-2.5 rounded-xl border border-brand-200 bg-brand-50 px-3.5 py-3">
            <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-brand-600" />
            <p className="text-[13px] leading-relaxed text-brand-900">{sent}</p>
          </div>
          <p className="text-[12.5px] leading-relaxed text-ink-500">
            Nothing arrived? Check the address, look in spam, or{' '}
            <button
              onClick={() => {
                setSent(null);
                setEmail('');
              }}
              className="font-semibold text-brand-700 underline decoration-brand-300 underline-offset-2"
            >
              try another email
            </button>
            .
          </p>
          <div className="rounded-xl bg-ink-50 px-3.5 py-3 text-[12px] leading-relaxed text-ink-500">
            <span className="font-semibold text-ink-700">This build has no mail server.</span> The message is sitting in
            the dev mailbox below — open it and click the link to continue the flow.
          </div>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-4">
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
                autoFocus
              />
            </div>
          </Field>

          {error && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-[13px] font-medium text-red-700">
              {error}
            </div>
          )}

          <Button type="submit" size="lg" block loading={loading} iconRight={ArrowRight}>
            Send reset link
          </Button>

          <p className="text-center text-[11.5px] text-ink-400">
            The answer is the same whether or not an account exists, so this form cannot be used to find out who has an
            account.
          </p>
        </form>
      )}
    </AuthShell>
  );
}
