import { useCallback, useEffect, useState } from 'react';
import {
  BadgeCheck, Crown, Loader2, MailWarning, RefreshCcw, ScanLine, Search, ShieldCheck, Trash2, UserRound, Users,
} from 'lucide-react';
import { Button, Card, CardHeader, Chip, Input, SectionTitle, Skeleton, SkeletonCard } from '../components/ui';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import type { AdminOverview, AdminUser } from '../lib/types';
import { cn } from '../lib/utils';

const dayLabel = (iso: string) =>
  new Date(`${iso}T12:00:00`).toLocaleDateString(undefined, { weekday: 'short' });

const relDate = (iso: string | null) => {
  if (!iso) return 'never';
  const diff = Math.round((Date.now() - new Date(iso).getTime()) / 864e5);
  if (diff <= 0) return 'today';
  if (diff === 1) return 'yesterday';
  if (diff < 30) return `${diff} days ago`;
  return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
};

function Stat({ icon: Icon, label, value, hint, tone = 'brand' }: {
  icon: typeof Users; label: string; value: string | number; hint?: string; tone?: 'brand' | 'sky' | 'amber';
}) {
  const tones = {
    brand: 'bg-brand-50 text-brand-700 ring-brand-200',
    sky: 'bg-sky-50 text-sky-700 ring-sky-200',
    amber: 'bg-amber-50 text-amber-700 ring-amber-200',
  } as const;
  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-400">{label}</p>
          <p className="mt-1.5 font-display text-[26px] font-bold leading-none tracking-tight text-ink-900">{value}</p>
          {hint && <p className="mt-1.5 text-[11.5px] text-ink-400">{hint}</p>}
        </div>
        <span className={cn('flex h-9 w-9 items-center justify-center rounded-xl ring-1 ring-inset', tones[tone])}>
          <Icon size={16} />
        </span>
      </div>
    </Card>
  );
}

export default function Admin() {
  const { user } = useAuth();
  const toast = useToast();
  const [data, setData] = useState<AdminOverview | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<number | null>(null);
  const [confirmId, setConfirmId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (q = '') => {
    setError(null);
    try {
      const [overview, list] = await Promise.all([api.admin.overview(), api.admin.users(q)]);
      setData(overview);
      setUsers(list.items);
    } catch (err: any) {
      setError(err?.message || 'Could not load the admin data.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const id = window.setTimeout(() => load(query.trim()), 250);
    return () => window.clearTimeout(id);
  }, [query, load]);

  const patch = async (u: AdminUser, body: { role?: string; emailVerified?: boolean }) => {
    setBusy(u.id);
    try {
      const res = await api.admin.updateUser(u.id, body);
      setUsers((prev) => prev.map((x) => (x.id === u.id ? res.item : x)));
      toast.success('Updated', res.message);
      load(query.trim());
    } catch (err: any) {
      toast.error('Not changed', err?.message || 'Try again.');
    } finally {
      setBusy(null);
    }
  };

  const remove = async (u: AdminUser) => {
    setBusy(u.id);
    try {
      await api.admin.removeUser(u.id);
      setUsers((prev) => prev.filter((x) => x.id !== u.id));
      toast.success('Account deleted', `${u.name}'s scans, logs and pantry are gone.`);
      setConfirmId(null);
      load(query.trim());
    } catch (err: any) {
      toast.error('Not deleted', err?.message || 'Try again.');
    } finally {
      setBusy(null);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-56" />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[0, 1, 2, 3].map((i) => <SkeletonCard key={i} rows={1} />)}
        </div>
        <SkeletonCard rows={6} />
      </div>
    );
  }

  if (error) {
    return (
      <Card className="mx-auto max-w-md p-8 text-center">
        <MailWarning className="mx-auto text-amber-500" size={26} />
        <p className="mt-3 font-display text-[17px] font-bold text-ink-900">Admin data unavailable</p>
        <p className="mt-1 text-[13px] text-ink-500">{error}</p>
        <Button className="mt-4" variant="secondary" icon={RefreshCcw} onClick={() => load(query)}>
          Try again
        </Button>
      </Card>
    );
  }

  const stats = data!.stats;
  const peak = Math.max(1, ...data!.activity.map((a) => a.scans));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-[26px] font-bold tracking-tight text-ink-900 sm:text-[30px]">Workspace admin</h1>
          <p className="mt-1 max-w-2xl text-[13.5px] leading-relaxed text-ink-500">
            Every account, what they have stored, and who still needs to confirm their email. You are signed in as{' '}
            <span className="font-semibold text-ink-800">{user?.name}</span> with the admin role.
          </p>
        </div>
        <Button variant="secondary" size="sm" icon={RefreshCcw} onClick={() => load(query.trim())}>
          Refresh
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat icon={Users} label="Accounts" value={stats.users} hint={`${stats.admins} admin · ${stats.oauth} via OAuth`} />
        <Stat
          icon={BadgeCheck}
          label="Email confirmed"
          value={`${stats.verificationRate}%`}
          hint={`${stats.verified} of ${stats.users} accounts`}
          tone="sky"
        />
        <Stat icon={ScanLine} label="Scans stored" value={stats.scans} hint={`Average risk score ${stats.avgScore}`} />
        <Stat icon={UserRound} label="Food logs" value={stats.logs} hint="Across all accounts" tone="amber" />
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title="Scans, last 7 days" subtitle="Every analysis run by any account." icon={ScanLine} />
          <div className="flex h-44 items-stretch gap-2 px-5 pb-5">
            {data!.activity.map((a) => (
              <div key={a.date} className="flex min-w-0 flex-1 flex-col items-center justify-end gap-1.5">
                <span className="text-[11px] font-semibold text-ink-500">{a.scans || ''}</span>
                <div
                  className={cn(
                    'w-full rounded-t-md bg-gradient-to-t',
                    a.scans ? 'from-brand-500 to-lime-400' : 'bg-ink-100'
                  )}
                  style={{ height: `${Math.max(4, (a.scans / peak) * 78)}%` }}
                  title={`${a.scans} scan${a.scans === 1 ? '' : 's'} on ${a.date}`}
                />
                <span className="text-[10.5px] text-ink-400">{dayLabel(a.date)}</span>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <CardHeader title="Most scanned" subtitle="What the workspace is eating." icon={Crown} />
          <div className="space-y-2.5 px-5 pb-5">
            {data!.topProducts.map((p, i) => (
              <div key={p.name} className="flex items-center gap-2.5">
                <span className="w-4 text-[11px] font-bold text-ink-300">{i + 1}</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[12.5px] font-semibold text-ink-800">{p.name}</p>
                  <p className="text-[11px] text-ink-400">
                    {p.count} scan{p.count === 1 ? '' : 's'} · avg {p.avgScore}
                  </p>
                </div>
                <Chip tone={p.avgScore >= 60 ? 'red' : p.avgScore >= 40 ? 'amber' : 'emerald'}>{p.avgScore}</Chip>
              </div>
            ))}
            {!data!.topProducts.length && <p className="text-[12.5px] text-ink-400">No scans yet.</p>}
          </div>
        </Card>
      </div>

      <Card>
        <CardHeader
          title="Accounts"
          subtitle="Promote to admin, confirm an email by hand, or delete an account and everything in it."
          icon={ShieldCheck}
          action={
            <div className="relative">
              <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search name or email…"
                className="h-9 w-full pl-8 text-[12.5px] sm:w-64"
              />
            </div>
          }
        />

        <div className="hidden overflow-x-auto px-5 pb-5 md:block">
          <table className="w-full min-w-[720px] border-collapse text-left">
            <thead>
              <tr className="border-b border-ink-100">
                {['Account', 'Role', 'Email', 'Stored', 'Last sign-in', ''].map((h) => (
                  <th key={h} className="pb-2 pr-3 text-[10.5px] font-semibold uppercase tracking-wider text-ink-400">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-b border-ink-50 last:border-0">
                  <td className="py-3 pr-3">
                    <div className="flex items-center gap-2.5">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-100 text-[11px] font-bold text-brand-800">
                        {u.name.split(' ').slice(0, 2).map((w) => w[0]).join('').toUpperCase()}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-[13px] font-semibold text-ink-900">
                          {u.name}
                          {u.id === user?.id && <span className="ml-1.5 text-[10.5px] font-medium text-ink-400">you</span>}
                        </p>
                        <p className="text-[11px] text-ink-400">{u.provider === 'password' ? 'Email & password' : `${u.provider} sign-in`}</p>
                      </div>
                    </div>
                  </td>
                  <td className="py-3 pr-3">
                    <button
                      onClick={() => patch(u, { role: u.role === 'admin' ? 'user' : 'admin' })}
                      disabled={busy === u.id}
                      className={cn(
                        'inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-[11px] font-semibold ring-1 ring-inset transition',
                        u.role === 'admin'
                          ? 'bg-ink-950 text-brand-300 ring-ink-800 hover:bg-ink-900'
                          : 'bg-white text-ink-600 ring-ink-200 hover:bg-ink-50'
                      )}
                      title={u.role === 'admin' ? 'Make a normal user' : 'Give admin access'}
                    >
                      {busy === u.id ? <Loader2 size={11} className="animate-spin" /> : u.role === 'admin' ? <Crown size={11} /> : <UserRound size={11} />}
                      {u.role === 'admin' ? 'Admin' : 'User'}
                    </button>
                  </td>
                  <td className="py-3 pr-3">
                    <button
                      onClick={() => patch(u, { emailVerified: !u.emailVerified })}
                      disabled={busy === u.id}
                      className={cn(
                        'inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-[11px] font-semibold ring-1 ring-inset transition',
                        u.emailVerified
                          ? 'bg-brand-50 text-brand-700 ring-brand-200 hover:bg-brand-100'
                          : 'bg-amber-50 text-amber-700 ring-amber-200 hover:bg-amber-100'
                      )}
                      title={u.emailVerified ? 'Mark as unconfirmed' : 'Mark as confirmed'}
                    >
                      {u.emailVerified ? <BadgeCheck size={11} /> : <MailWarning size={11} />}
                      {u.emailVerified ? 'Confirmed' : 'Pending'}
                    </button>
                  </td>
                  <td className="py-3 pr-3 text-[12px] text-ink-600">
                    {u.scans} scans · {u.logs} logs · {u.products} products
                  </td>
                  <td className="py-3 pr-3 text-[12px] text-ink-500">{relDate(u.lastLoginAt)}</td>
                  <td className="py-3 text-right">
                    {confirmId === u.id ? (
                      <span className="inline-flex items-center gap-1">
                        <button
                          onClick={() => remove(u)}
                          className="rounded-lg bg-red-600 px-2 py-1 text-[11px] font-semibold text-white hover:bg-red-700"
                        >
                          Delete
                        </button>
                        <button
                          onClick={() => setConfirmId(null)}
                          className="rounded-lg px-2 py-1 text-[11px] font-medium text-ink-500 hover:bg-ink-100"
                        >
                          Cancel
                        </button>
                      </span>
                    ) : (
                      <button
                        onClick={() => setConfirmId(u.id)}
                        disabled={u.id === user?.id}
                        className="rounded-lg p-1.5 text-ink-300 transition hover:bg-red-50 hover:text-red-600 disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-ink-300"
                        title={u.id === user?.id ? 'You cannot delete yourself' : 'Delete account'}
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!users.length && <p className="py-6 text-center text-[13px] text-ink-400">No accounts match “{query}”.</p>}
        </div>

        {/* mobile cards */}
        <div className="space-y-2.5 px-5 pb-5 md:hidden">
          {users.map((u) => (
            <div key={u.id} className="rounded-xl border border-ink-100 p-3">
              <div className="flex items-center gap-2.5">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-100 text-[11px] font-bold text-brand-800">
                  {u.name.split(' ').slice(0, 2).map((w) => w[0]).join('').toUpperCase()}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-semibold text-ink-900">{u.name}</p>
                  <p className="truncate text-[11px] text-ink-400">{u.email}</p>
                </div>
              </div>
              <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                <button
                  onClick={() => patch(u, { role: u.role === 'admin' ? 'user' : 'admin' })}
                  className={cn(
                    'inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-semibold ring-1 ring-inset',
                    u.role === 'admin' ? 'bg-ink-950 text-brand-300 ring-ink-800' : 'bg-white text-ink-600 ring-ink-200'
                  )}
                >
                  {u.role === 'admin' ? <Crown size={11} /> : <UserRound size={11} />} {u.role === 'admin' ? 'Admin' : 'User'}
                </button>
                <button
                  onClick={() => patch(u, { emailVerified: !u.emailVerified })}
                  className={cn(
                    'inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-semibold ring-1 ring-inset',
                    u.emailVerified ? 'bg-brand-50 text-brand-700 ring-brand-200' : 'bg-amber-50 text-amber-700 ring-amber-200'
                  )}
                >
                  {u.emailVerified ? <BadgeCheck size={11} /> : <MailWarning size={11} />} {u.emailVerified ? 'Confirmed' : 'Pending'}
                </button>
                <span className="text-[11px] text-ink-400">{u.scans} scans · {u.logs} logs</span>
                {u.id !== user?.id && (
                  <button
                    onClick={() => (confirmId === u.id ? remove(u) : setConfirmId(u.id))}
                    className="ml-auto rounded-lg p-1.5 text-ink-300 hover:bg-red-50 hover:text-red-600"
                  >
                    <Trash2 size={13} />
                  </button>
                )}
              </div>
              {confirmId === u.id && (
                <p className="mt-2 text-[11.5px] font-medium text-red-600">Tap the bin again to delete permanently.</p>
              )}
            </div>
          ))}
        </div>
      </Card>

      <SectionTitle>Safety rails</SectionTitle>
      <Card className="p-4">
        <ul className="space-y-1.5 text-[12.5px] leading-relaxed text-ink-600">
          <li>• You cannot demote or delete the account you are signed in with, and the workspace always keeps at least one admin.</li>
          <li>• Deleting an account removes its pantry, scans and food logs (SQLite cascade) — global catalogue data is untouched.</li>
          <li>• Confirming an email by hand mints no tokens; it just flips the verified flag so a locked-out user can recover.</li>
          <li>• This page is server-guarded: non-admins get a 403 even if they know the URL.</li>
        </ul>
      </Card>
    </div>
  );
}
