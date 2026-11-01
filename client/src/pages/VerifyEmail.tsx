import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowRight, CheckCircle2, Loader2, MailCheck, MailWarning, RefreshCcw } from 'lucide-react';
import AuthShell from '../components/AuthShell';
import { Button } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { api } from '../lib/api';

type State = 'working' | 'ok' | 'fail';

export default function VerifyEmail() {
  const [params] = useSearchParams();
  const token = params.get('token') || '';
  const { user, setUser, refresh } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();

  const [state, setState] = useState<State>(token ? 'working' : 'fail');
  const [message, setMessage] = useState(
    token ? '' : 'This confirmation link is missing its code. Open the link straight from the email.'
  );
  const [resending, setResending] = useState(false);
  const started = useRef(false);

  useEffect(() => {
    if (!token || started.current) return;
    started.current = true;
    (async () => {
      try {
        const res = await api.auth.verifyEmail(token);
        setMessage(res.message);
        setState('ok');
        const isCurrent = user && user.id === res.user.id;
        if (isCurrent) setUser(res.user);
        else if (user) await refresh();
        toast.success('Email confirmed', res.message);
      } catch (err: any) {
        setMessage(err?.message || 'That link did not work.');
        setState('fail');
      }
    })();
  }, [token, user, setUser, refresh, toast]);

  const resend = async () => {
    setResending(true);
    try {
      const res = await api.auth.resendVerification();
      toast.success('Sent', res.message);
      setMessage(res.message);
      setState('working');
    } catch (err: any) {
      toast.error('Could not resend', err?.message || 'Try again in a moment.');
    } finally {
      setResending(false);
    }
  };

  return (
    <AuthShell
      title={state === 'ok' ? 'Email confirmed' : state === 'working' ? 'Confirming your email…' : 'That link did not work'}
      subtitle={
        state === 'ok'
          ? 'Thanks — this address is now verified, so password resets and account notices will reach you.'
          : state === 'working'
            ? 'Hang on a second while we check the code.'
            : undefined
      }
      backTo={user ? '/' : '/login'}
      backLabel={user ? 'Back to the app' : 'Back to sign in'}
    >
      {state === 'working' && (
        <div className="flex items-center gap-2.5 rounded-xl bg-ink-50 px-3.5 py-3 text-[13px] font-medium text-ink-600">
          <Loader2 size={16} className="animate-spin text-brand-600" /> Verifying…
        </div>
      )}

      {state === 'ok' && (
        <div className="space-y-4">
          <div className="flex items-start gap-2.5 rounded-xl border border-brand-200 bg-brand-50 px-3.5 py-3">
            <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-brand-600" />
            <p className="text-[13px] leading-relaxed text-brand-900">{message || 'Your email address is confirmed.'}</p>
          </div>
          <Button size="lg" block iconRight={ArrowRight} onClick={() => navigate(user ? '/' : '/login', { replace: true })}>
            {user ? 'Go to my dashboard' : 'Sign in'}
          </Button>
        </div>
      )}

      {state === 'fail' && (
        <div className="space-y-4">
          <div className="flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-3">
            <MailWarning size={16} className="mt-0.5 shrink-0 text-amber-600" />
            <p className="text-[13px] leading-relaxed text-amber-900">{message}</p>
          </div>

          {user && !user.emailVerified && (
            <Button size="lg" block variant="secondary" loading={resending} icon={RefreshCcw} onClick={resend}>
              Send me a new link
            </Button>
          )}

          <p className="text-[12.5px] leading-relaxed text-ink-500">
            Confirmation links expire after 24 hours and work once. Signed in?{' '}
            <Link to="/profile" className="font-semibold text-brand-700 underline decoration-brand-300 underline-offset-2">
              Send a fresh link from your profile
            </Link>
            .
          </p>

          {!user && (
            <Link
              to="/login"
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-ink-200 bg-white px-4 py-2.5 text-[13.5px] font-semibold text-ink-800 transition hover:bg-ink-50"
            >
              <MailCheck size={15} /> Back to sign in
            </Link>
          )}
        </div>
      )}
    </AuthShell>
  );
}
