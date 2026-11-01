import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronDown, Inbox, KeyRound, Loader2, Mail, ShieldCheck, Trash2 } from 'lucide-react';
import { api } from '../lib/api';
import type { MailMessage } from '../lib/types';
import { cn } from '../lib/utils';

const KIND = {
  verify: { label: 'Confirm email', tone: 'bg-sky-50 text-sky-700 ring-sky-200', icon: ShieldCheck },
  reset: { label: 'Reset password', tone: 'bg-amber-50 text-amber-700 ring-amber-200', icon: KeyRound },
  notice: { label: 'Notice', tone: 'bg-ink-100 text-ink-600 ring-ink-200', icon: Mail },
} as const;

const relTime = (iso: string) => {
  const diff = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (diff < 1) return 'just now';
  if (diff < 60) return `${diff} min ago`;
  if (diff < 1440) return `${Math.round(diff / 60)} h ago`;
  return `${Math.round(diff / 1440)} d ago`;
};

/**
 * There is no SMTP account in this build, so every outgoing message — email
 * confirmations, password resets, welcome notes — is captured here instead.
 * Everything is a real, single-use, expiring token; only the delivery is local.
 */
export default function DevMailbox({ defaultOpen = false, className }: { defaultOpen?: boolean; className?: string }) {
  const [open, setOpen] = useState(defaultOpen);
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<MailMessage[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.auth.mailbox();
      setMessages(res.messages);
    } catch (err: any) {
      setError(err?.message || 'Mailbox unavailable.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    const id = window.setInterval(load, 15000);
    return () => window.clearInterval(id);
  }, []);

  // expand automatically once something has been sent (e.g. right after a reset request)
  useEffect(() => {
    if (defaultOpen) setOpen(true);
  }, [defaultOpen]);

  const clear = async () => {
    try {
      await api.auth.clearMailbox();
      setMessages([]);
    } catch {
      /* ignore */
    }
  };

  return (
    <div className={cn('rounded-2xl border border-ink-200 bg-white/90 shadow-sm', className)}>
      <button onClick={() => setOpen((o) => !o)} className="flex w-full items-center gap-2.5 px-3.5 py-3 text-left">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-ink-950 text-brand-300">
          <Inbox size={15} />
        </span>
        <span className="flex-1">
          <span className="block text-[12.5px] font-semibold text-ink-900">Dev mailbox</span>
          <span className="block text-[11px] text-ink-400">
            {loading && !messages.length
              ? 'Checking…'
              : messages.length
                ? `${messages.length} message${messages.length > 1 ? 's' : ''} · no SMTP in this build`
                : 'No messages yet'}
          </span>
        </span>
        {loading && messages.length > 0 && <Loader2 size={13} className="animate-spin text-ink-300" />}
        <ChevronDown size={15} className={cn('text-ink-400 transition', open && 'rotate-180')} />
      </button>

      {open && (
        <div className="border-t border-ink-100 px-3.5 py-3">
          <p className="mb-2.5 text-[11px] leading-relaxed text-ink-400">
            NutriLens has no mail server configured, so confirmation and reset emails are collected here (and printed to
            the server console). Links are real, single-use and expire.
          </p>

          {error && <p className="text-[12px] font-medium text-red-600">{error}</p>}

          {!loading && !messages.length && !error && (
            <p className="rounded-xl bg-ink-50 px-3 py-4 text-center text-[12px] text-ink-400">
              Nothing here yet — request a reset link or create an account.
            </p>
          )}

          <div className="space-y-2">
            {messages.map((m) => {
              const meta = KIND[(m.kind as keyof typeof KIND) || 'notice'] || KIND.notice;
              const path = m.link ? m.link.replace(/^https?:\/\/[^/]+/, '') : null;
              return (
                <div key={m.id} className="rounded-xl border border-ink-100 bg-white p-2.5">
                  <div className="flex items-center gap-2">
                    <span className={cn('inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-semibold ring-1 ring-inset', meta.tone)}>
                      <meta.icon size={10} /> {meta.label}
                    </span>
                    <span className="truncate text-[11px] text-ink-400">{m.to}</span>
                    <span className="ml-auto shrink-0 text-[10.5px] text-ink-300">{relTime(m.createdAt)}</span>
                  </div>
                  <p className="mt-1.5 text-[12.5px] font-semibold text-ink-800">{m.subject}</p>
                  {path ? (
                    <Link
                      to={path}
                      className="mt-1.5 inline-flex items-center gap-1 rounded-lg bg-brand-600 px-2.5 py-1 text-[11.5px] font-semibold text-white hover:bg-brand-700"
                    >
                      Open the link
                    </Link>
                  ) : (
                    <p className="mt-1 line-clamp-2 text-[11.5px] text-ink-500">{m.body}</p>
                  )}
                </div>
              );
            })}
          </div>

          {messages.length > 0 && (
            <button
              onClick={clear}
              className="mt-2.5 inline-flex items-center gap-1 text-[11px] font-medium text-ink-400 transition hover:text-red-600"
            >
              <Trash2 size={11} /> Clear mailbox
            </button>
          )}
        </div>
      )}
    </div>
  );
}
