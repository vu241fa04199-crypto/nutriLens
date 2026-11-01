import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Activity, BadgeCheck, CheckCircle2, Crown, HeartPulse, Info, KeyRound, Lock, Mail, MailWarning, RefreshCcw, Ruler, Save,
  Scale, ShieldCheck, Sparkles, UserRound, Weight, X,
} from 'lucide-react';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import type { Meta } from '../lib/types';
import { Button, Card, CardHeader, Chip, Field, Input, Select } from '../components/ui';
import DevMailbox from '../components/DevMailbox';
import { bmi, bmiLabel, cn } from '../lib/utils';

const ACTIVITY = [
  { value: 'sedentary', label: 'Sedentary — desk job, little exercise' },
  { value: 'light', label: 'Lightly active — walks, 1–2 workouts/week' },
  { value: 'moderate', label: 'Moderately active — 3–4 workouts/week' },
  { value: 'high', label: 'Very active — daily training or physical job' },
];

export default function Profile() {
  const { user, setUser } = useAuth();
  const toast = useToast();
  const [meta, setMeta] = useState<Meta | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: user?.name || '',
    age: user?.age || 0,
    sex: user?.sex || '',
    heightCm: user?.heightCm || 0,
    weightKg: user?.weightKg || 0,
    activity: user?.activity || 'moderate',
    conditions: user?.conditions || [],
    allergies: user?.allergies || [],
  });
  const [allergyDraft, setAllergyDraft] = useState('');

  const [pwd, setPwd] = useState({ current: '', next: '', confirm: '' });
  const [sendingVerify, setSendingVerify] = useState(false);
  const [pwdSaving, setPwdSaving] = useState(false);

  useEffect(() => {
    api.meta().then(setMeta).catch(() => {});
  }, []);

  const dirty = useMemo(() => {
    if (!user) return false;
    return (
      form.name !== user.name ||
      Number(form.age) !== Number(user.age || 0) ||
      form.sex !== (user.sex || '') ||
      Number(form.heightCm) !== Number(user.heightCm || 0) ||
      Number(form.weightKg) !== Number(user.weightKg || 0) ||
      form.activity !== (user.activity || 'moderate') ||
      JSON.stringify([...form.conditions].sort()) !== JSON.stringify([...(user.conditions || [])].sort()) ||
      JSON.stringify([...form.allergies].sort()) !== JSON.stringify([...(user.allergies || [])].sort())
    );
  }, [form, user]);

  const bmiValue = bmi(form.weightKg, form.heightCm);
  const conditionMeta = meta?.conditions || [];

  const save = async () => {
    if (form.name.trim().length < 2) {
      toast.error('Your name needs at least two characters');
      return;
    }
    setSaving(true);
    const previous = user;
    if (user) setUser({ ...user, ...form, name: form.name.trim() } as any);
    try {
      const res = await api.auth.update({ ...form, name: form.name.trim() });
      setUser(res.user);
      toast.success('Health profile saved', 'Your scores and portion guidance now use these details.');
    } catch (e: any) {
      if (previous) setUser(previous);
      toast.error('Could not save your profile', e.message);
    } finally {
      setSaving(false);
    }
  };

  const resendVerification = async () => {
    setSendingVerify(true);
    try {
      const res = await api.auth.resendVerification();
      toast.success('Confirmation link sent', res.message);
    } catch (err: any) {
      toast.error('Could not send the link', err?.message || 'Try again in a moment.');
    } finally {
      setSendingVerify(false);
    }
  };

  const addAllergy = () => {
    const value = allergyDraft.trim();
    if (!value) return;
    if (!form.allergies.includes(value)) setForm((f) => ({ ...f, allergies: [...f.allergies, value] }));
    setAllergyDraft('');
  };

  const changePassword = async () => {
    if (pwd.next.length < 6) {
      toast.error('New password must be at least 6 characters');
      return;
    }
    if (pwd.next !== pwd.confirm) {
      toast.error('The new passwords do not match');
      return;
    }
    setPwdSaving(true);
    try {
      await api.auth.password(pwd.current, pwd.next);
      setPwd({ current: '', next: '', confirm: '' });
      toast.success('Password updated');
    } catch (e: any) {
      toast.error('Could not change password', e.message);
    } finally {
      setPwdSaving(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-[26px] font-bold tracking-tight text-ink-900 sm:text-[30px]">Health profile</h1>
          <p className="mt-1 max-w-xl text-[13.5px] leading-relaxed text-ink-500">
            This is what makes the scoring personal. Conditions change which nutrient we treat as the priority — and how blunt we are about it.
          </p>
        </div>
        <Button icon={Save} loading={saving} onClick={save} disabled={!dirty} className={cn(!dirty && 'opacity-60')}>
          {dirty ? 'Save changes' : 'All saved'}
        </Button>
      </div>

      <div className="grid grid-cols-1 grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card>
            <CardHeader title="About you" subtitle="Used for energy, protein and BMI maths" icon={UserRound} />
            <div className="card-pad space-y-4">
              <div className="grid grid-cols-1 grid gap-3 sm:grid-cols-2">
                <Field label="Full name">
                  <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
                </Field>
                <Field label="Email" hint="Your sign-in address can't be changed.">
                  <div className="relative">
                    <Mail size={14} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-300" />
                    <Input value={user?.email || ''} disabled className="pl-9" />
                  </div>
                </Field>
              </div>

              <div className="grid grid-cols-1 grid gap-3 sm:grid-cols-3">
                <Field label="Age">
                  <Input type="number" min={10} max={110} value={form.age || ''} onChange={(e) => setForm((f) => ({ ...f, age: Number(e.target.value) }))} />
                </Field>
                <Field label="Sex">
                  <Select value={form.sex} onChange={(e) => setForm((f) => ({ ...f, sex: e.target.value }))}>
                    <option value="">Prefer not to say</option>
                    <option value="female">Female</option>
                    <option value="male">Male</option>
                    <option value="other">Other</option>
                  </Select>
                </Field>
                <Field label="Activity level">
                  <Select value={form.activity} onChange={(e) => setForm((f) => ({ ...f, activity: e.target.value }))}>
                    {ACTIVITY.map((a) => (
                      <option key={a.value} value={a.value}>{a.label.split(' — ')[0]}</option>
                    ))}
                  </Select>
                </Field>
              </div>

              <div className="grid grid-cols-1 grid gap-3 sm:grid-cols-3">
                <Field label="Height">
                  <div className="relative">
                    <Ruler size={14} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-300" />
                    <Input
                      type="number"
                      min={80}
                      max={250}
                      value={form.heightCm || ''}
                      onChange={(e) => setForm((f) => ({ ...f, heightCm: Number(e.target.value) }))}
                      className="pl-9 pr-9"
                    />
                    <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[11px] text-ink-400">cm</span>
                  </div>
                </Field>
                <Field label="Weight">
                  <div className="relative">
                    <Weight size={14} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-300" />
                    <Input
                      type="number"
                      min={20}
                      max={300}
                      value={form.weightKg || ''}
                      onChange={(e) => setForm((f) => ({ ...f, weightKg: Number(e.target.value) }))}
                      className="pl-9 pr-9"
                    />
                    <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[11px] text-ink-400">kg</span>
                  </div>
                </Field>
                <div className="rounded-xl bg-ink-50 p-3">
                  <p className="flex items-center gap-1 text-[10.5px] font-medium uppercase tracking-wide text-ink-400">
                    <Scale size={11} /> BMI
                  </p>
                  <p className="mt-1 font-display text-[20px] font-bold leading-none text-ink-900">{bmiValue ?? '—'}</p>
                  <p className="mt-0.5 text-[11px] font-medium text-ink-500">{bmiLabel(bmiValue)}</p>
                </div>
              </div>
            </div>
          </Card>

          <Card>
            <CardHeader
              title="Conditions you're managing"
              subtitle="Every scan is re-scored against these"
              icon={HeartPulse}
              action={<Chip tone="sky">{form.conditions.length} selected</Chip>}
            />
            <div className="card-pad">
              <div className="grid grid-cols-1 grid gap-2 sm:grid-cols-2">
                {conditionMeta.map((c) => {
                  const active = form.conditions.includes(c.id);
                  return (
                    <button
                      key={c.id}
                      onClick={() =>
                        setForm((f) => ({
                          ...f,
                          conditions: active ? f.conditions.filter((x) => x !== c.id) : [...f.conditions, c.id],
                        }))
                      }
                      className={cn(
                        'flex items-start gap-2.5 rounded-xl border p-3 text-left transition',
                        active ? 'border-brand-500 bg-brand-50/70 ring-2 ring-brand-500/15' : 'border-ink-200 bg-white hover:bg-ink-50'
                      )}
                    >
                      <span
                        className={cn(
                          'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition',
                          active ? 'border-brand-600 bg-brand-600 text-white' : 'border-ink-300 bg-white'
                        )}
                      >
                        {active && <BadgeCheck size={12} />}
                      </span>
                      <span className="min-w-0">
                        <span className={cn('block text-[12.5px] font-semibold', active ? 'text-brand-900' : 'text-ink-800')}>{c.label}</span>
                        <span className="block text-[11px] leading-snug text-ink-500">{c.blurb}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
              {conditionMeta.length === 0 && <p className="text-[12.5px] text-ink-400">Loading conditions…</p>}
            </div>
          </Card>

          <Card>
            <CardHeader title="Allergies & things to avoid" subtitle="Shown as a warning on matching scans" icon={Sparkles} />
            <div className="card-pad">
              <div className="flex flex-wrap gap-1.5">
                {form.allergies.map((a) => (
                  <span key={a} className="chip bg-amber-50 text-amber-800 ring-amber-200">
                    {a}
                    <button
                      onClick={() => setForm((f) => ({ ...f, allergies: f.allergies.filter((x) => x !== a) }))}
                      className="ml-0.5 rounded p-0.5 hover:bg-amber-100"
                      aria-label={`Remove ${a}`}
                    >
                      <X size={11} />
                    </button>
                  </span>
                ))}
                {form.allergies.length === 0 && <span className="text-[12.5px] text-ink-400">Nothing added yet.</span>}
              </div>
              <div className="mt-3 flex gap-2">
                <Input
                  value={allergyDraft}
                  onChange={(e) => setAllergyDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      addAllergy();
                    }
                  }}
                  placeholder="e.g. peanut, lactose, gluten"
                  className="max-w-xs"
                />
                <Button variant="secondary" onClick={addAllergy}>Add</Button>
              </div>
            </div>
          </Card>

          <Card>
            <CardHeader
              title="Email & account security"
              subtitle="Where reset links go, how you sign in, and what you are allowed to do"
              icon={ShieldCheck}
            />
            <div className="card-pad space-y-3">
              <div className="flex flex-wrap items-center gap-2 rounded-xl border border-ink-100 bg-ink-50/60 px-3.5 py-3">
                <Mail size={15} className="text-ink-400" />
                <span className="min-w-0 flex-1 truncate text-[13px] font-semibold text-ink-800">{user?.email}</span>
                {user?.emailVerified ? (
                  <span className="inline-flex items-center gap-1 rounded-lg bg-brand-50 px-2 py-1 text-[11px] font-semibold text-brand-700 ring-1 ring-inset ring-brand-200">
                    <BadgeCheck size={11} /> Confirmed
                  </span>
                ) : (
                  <>
                    <span className="inline-flex items-center gap-1 rounded-lg bg-amber-50 px-2 py-1 text-[11px] font-semibold text-amber-700 ring-1 ring-inset ring-amber-200">
                      <MailWarning size={11} /> Not confirmed
                    </span>
                    <Button
                      size="sm"
                      variant="secondary"
                      icon={sendingVerify ? undefined : RefreshCcw}
                      loading={sendingVerify}
                      onClick={resendVerification}
                    >
                      Send link
                    </Button>
                  </>
                )}
              </div>

              <div className="grid gap-2 sm:grid-cols-3">
                <div className="rounded-xl border border-ink-100 px-3 py-2.5">
                  <p className="text-[10.5px] font-semibold uppercase tracking-wide text-ink-400">Sign-in method</p>
                  <p className="mt-0.5 flex items-center gap-1.5 text-[12.5px] font-semibold text-ink-800">
                    {user?.provider === 'password' ? <KeyRound size={12} className="text-ink-400" /> : <CheckCircle2 size={12} className="text-brand-600" />}
                    {user?.provider === 'password' ? 'Email & password' : `${user?.provider} OAuth`}
                  </p>
                </div>
                <div className="rounded-xl border border-ink-100 px-3 py-2.5">
                  <p className="text-[10.5px] font-semibold uppercase tracking-wide text-ink-400">Workspace role</p>
                  <p className="mt-0.5 flex items-center gap-1.5 text-[12.5px] font-semibold text-ink-800">
                    {user?.role === 'admin' ? <Crown size={12} className="text-amber-500" /> : <UserRound size={12} className="text-ink-400" />}
                    {user?.role === 'admin' ? 'Admin' : 'Member'}
                  </p>
                </div>
                <div className="rounded-xl border border-ink-100 px-3 py-2.5">
                  <p className="text-[10.5px] font-semibold uppercase tracking-wide text-ink-400">Last sign-in</p>
                  <p className="mt-0.5 text-[12.5px] font-semibold text-ink-800">
                    {user?.lastLoginAt ? new Date(user.lastLoginAt).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }) : '—'}
                  </p>
                </div>
              </div>

              <p className="text-[12px] leading-relaxed text-ink-500">
                Forgot the password entirely?{' '}
                <Link to="/forgot" className="font-semibold text-brand-700 underline decoration-brand-300 underline-offset-2">
                  Send yourself a reset link
                </Link>{' '}
                instead of changing it here.
              </p>
            </div>
          </Card>

          <Card>
            <CardHeader title="Password" subtitle="Use a password manager if you can" icon={KeyRound} />
            <div className="grid grid-cols-1 card-pad grid gap-3 sm:grid-cols-3">
              <Field label="Current password">
                <Input type="password" value={pwd.current} onChange={(e) => setPwd((p) => ({ ...p, current: e.target.value }))} placeholder="••••••••" />
              </Field>
              <Field label="New password">
                <Input type="password" value={pwd.next} onChange={(e) => setPwd((p) => ({ ...p, next: e.target.value }))} placeholder="At least 6 characters" />
              </Field>
              <Field label="Confirm new password">
                <Input type="password" value={pwd.confirm} onChange={(e) => setPwd((p) => ({ ...p, confirm: e.target.value }))} placeholder="Repeat it" />
              </Field>
              <div className="sm:col-span-3">
                <Button variant="secondary" icon={Lock} loading={pwdSaving} onClick={changePassword} disabled={!pwd.current || !pwd.next}>
                  Update password
                </Button>
              </div>
            </div>
          </Card>
        </div>

        {/* side */}
        <div className="space-y-4">
          <Card className="bg-gradient-to-br from-ink-950 to-ink-900 p-5 text-white">
            <div className="flex items-center gap-3">
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10 text-[15px] font-bold text-brand-200 ring-1 ring-inset ring-white/15">
                {user?.initials || user?.name?.slice(0, 2).toUpperCase()}
              </span>
              <div className="min-w-0">
                <p className="truncate font-display text-[15px] font-semibold">{user?.name}</p>
                <p className="truncate text-[11.5px] text-white/40">{user?.email}</p>
              </div>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <div className="rounded-xl bg-white/[0.06] p-2.5">
                <p className="text-[10px] uppercase tracking-wide text-white/40">Conditions</p>
                <p className="mt-0.5 font-display text-[18px] font-bold">{form.conditions.length}</p>
              </div>
              <div className="rounded-xl bg-white/[0.06] p-2.5">
                <p className="text-[10px] uppercase tracking-wide text-white/40">Member since</p>
                <p className="mt-0.5 text-[12.5px] font-semibold">
                  {user?.createdAt ? new Date(user.createdAt).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' }) : '—'}
                </p>
              </div>
            </div>
            {form.conditions.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1">
                {form.conditions.map((c) => (
                  <span key={c} className="rounded-md bg-brand-400/15 px-1.5 py-0.5 text-[10.5px] font-medium text-brand-200">
                    {conditionMeta.find((m) => m.id === c)?.label || c}
                  </span>
                ))}
              </div>
            )}
          </Card>

          <DevMailbox />

          <Card>
            <CardHeader title="Why this matters" icon={Info} />
            <div className="card-pad space-y-3 text-[12.5px] leading-relaxed text-ink-500">
              <p className="flex gap-2">
                <Activity size={14} className="mt-0.5 shrink-0 text-brand-600" />
                With diabetes selected, a high-sugar snack gets a harsher score and the report explains the glucose spike mechanism instead of
                just listing grams.
              </p>
              <p className="flex gap-2">
                <HeartPulse size={14} className="mt-0.5 shrink-0 text-brand-600" />
                With hypertension selected, sodium becomes the binding constraint on your "safe daily amount" — you'll see it shrink immediately.
              </p>
              <p className="flex gap-2">
                <Scale size={14} className="mt-0.5 shrink-0 text-brand-600" />
                Height, weight and activity refine energy targets and BMI context, so calorie advice isn't generic.
              </p>
            </div>
          </Card>

          <Card className="p-4">
            <p className="text-[11.5px] leading-relaxed text-ink-400">
              Your data stays in this app's local database. Nothing is sent to third parties, and you can change or remove any of this at any time.
            </p>
          </Card>
        </div>
      </div>

      <p className="px-1 text-center text-[11px] text-ink-400">
        Member since {user?.createdAt ? new Date(user.createdAt).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' }) : '—'} · your profile
        is stored in this app's local database and never shared.
      </p>
    </div>
  );
}
