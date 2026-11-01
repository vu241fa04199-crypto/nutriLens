import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Loader2, ShieldAlert } from 'lucide-react';
import AuthShell from '../components/AuthShell';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

export default function OAuthCallback() {
  const [params] = useSearchParams();
  const token = params.get('token') || '';
  const error = params.get('error') || '';
  const { adoptToken } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [message, setMessage] = useState(error);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    if (error || !token) {
      setMessage(error || 'The sign-in response was missing its token.');
      return;
    }
    (async () => {
      try {
        const user = await adoptToken(token);
        toast.success(`Welcome, ${user.name.split(' ')[0]}`, 'Signed in with your linked account.');
        navigate('/', { replace: true });
      } catch (err: any) {
        setMessage(err?.message || 'Could not finish signing in.');
      }
    })();
  }, [token, error, adoptToken, navigate, toast]);

  if (message) {
    return (
      <AuthShell title="Sign-in did not finish" subtitle="Nothing was changed on your account.">
        <div className="flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-3 text-[13px] leading-relaxed text-amber-900">
          <ShieldAlert size={16} className="mt-0.5 shrink-0 text-amber-600" /> {message}
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell title="Signing you in…" subtitle="Talking to the provider and setting up your session.">
      <div className="flex items-center gap-2.5 rounded-xl bg-ink-50 px-3.5 py-3 text-[13px] font-medium text-ink-600">
        <Loader2 size={16} className="animate-spin text-brand-600" /> One moment…
      </div>
    </AuthShell>
  );
}
