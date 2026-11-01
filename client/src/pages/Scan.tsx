import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  AlertTriangle, ArrowRight, BadgeCheck, Bookmark, BookmarkCheck, Camera, Check, ClipboardPaste,
  Clock, ClipboardList, FlaskConical, Info, Leaf, Loader2, Package, ScanLine, Search, ShieldAlert,
  Sparkles, Tag, TriangleAlert, Wand2, FileText, Scale, HeartPulse,
} from 'lucide-react';
import CameraScan from '../components/CameraScan';
import { api } from '../lib/api';
import { useToast } from '../context/ToastContext';
import type { Additive, Alternative, Analysis, Meta, Nutrition, Product, Tone } from '../lib/types';
import {
  Button, Card, CardHeader, Chip, EmptyState, Field, Input, Modal, NumberField, Select, Skeleton, Textarea, Progress,
} from '../components/ui';
import { ScoreRing } from '../components/ScoreRing';
import { NutrientBars } from '../components/charts';
import {
  cn, emptyNutrition, MEALS, NOVA_OPTIONS, nf, pct, severityTone, TONE_CHIP, TONE_TEXT, toneForScore,
  verdictLabel, todayKey,
} from '../lib/utils';

interface FormState {
  productName: string;
  brand: string;
  category: string;
  servingG: number;
  servingLabel: string;
  portionG: number;
  nova: number;
  nutrition: Nutrition;
  ingredients: string;
}

const DEFAULT_FORM: FormState = {
  productName: '',
  brand: '',
  category: 'snack',
  servingG: 30,
  servingLabel: '',
  portionG: 30,
  nova: 4,
  nutrition: emptyNutrition(),
  ingredients: '',
};

const TAB_ICONS = { overview: Sparkles, consequences: HeartPulse, limits: Scale, ingredients: FlaskConical, swaps: Leaf } as const;
type TabKey = keyof typeof TAB_ICONS;

const SEVERITY_LABEL: Record<string, string> = { high: 'High impact', medium: 'Moderate impact', low: 'Low impact' };

/* ------------------------------------------------------------------ helpers */
function useDebounced<T>(value: T, delay = 300) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return debounced;
}

/* =========================================================================== */
export default function Scan() {
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const toast = useToast();

  const [meta, setMeta] = useState<Meta | null>(null);
  const [form, setForm] = useState<FormState>(DEFAULT_FORM);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [alternatives, setAlternatives] = useState<Alternative[]>([]);
  const [analyzedPortion, setAnalyzedPortion] = useState<number | null>(null);

  const [analyzing, setAnalyzing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [logging, setLogging] = useState(false);
  const [savedScanId, setSavedScanId] = useState<number | null>(null);
  const [savedNotes, setSavedNotes] = useState('');
  const [showNotes, setShowNotes] = useState(false);
  const [logOpen, setLogOpen] = useState(false);
  const [logMeal, setLogMeal] = useState<'breakfast' | 'lunch' | 'dinner' | 'snack'>('snack');
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<TabKey>('overview');
  const [loadingSaved, setLoadingSaved] = useState(false);
  const [pasteOpen, setPasteOpen] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [pasteText, setPasteText] = useState('');
  const [parsing, setParsing] = useState(false);

  const resultsRef = useRef<HTMLDivElement>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    api.meta().then(setMeta).catch(() => {});
  }, []);

  /* ---------------------------------------------------- load saved entities */
  useEffect(() => {
    const scanId = params.get('scan');
    const productId = params.get('product');
    if (scanId) {
      setLoadingSaved(true);
      api.scans
        .get(Number(scanId))
        .then(({ item, alternatives: alts }) => {
          setForm({
            productName: item.productName,
            brand: item.brand,
            category: item.category,
            servingG: item.servingG,
            servingLabel: `${item.servingG} g`,
            portionG: item.portionG,
            nova: item.nova,
            nutrition: item.nutrition,
            ingredients: item.ingredients,
          });
          setAnalysis(item.result || null);
          setAlternatives(alts);
          setSavedScanId(item.id);
          setSavedNotes(item.notes || '');
          setAnalyzedPortion(item.portionG);
          setTab('overview');
        })
        .catch(() => toast.error('Could not open that scan', 'It may have been deleted.'))
        .finally(() => {
          setLoadingSaved(false);
          setParams({}, { replace: true });
        });
    } else if (productId) {
      setLoadingSaved(true);
      api.products
        .get(Number(productId))
        .then(({ item }) => {
          setForm({
            productName: item.name,
            brand: item.brand,
            category: item.category,
            servingG: item.servingG,
            servingLabel: item.servingLabel,
            portionG: item.servingG,
            nova: item.nova,
            nutrition: item.nutrition,
            ingredients: item.ingredients,
          });
          setAnalysis(null);
          setSavedScanId(null);
        })
        .catch(() => toast.error('Could not load that product'))
        .finally(() => {
          setLoadingSaved(false);
          setParams({}, { replace: true });
        });
    }
  }, [params, setParams, toast]);

  const patch = useCallback(<K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
    if (key === 'portionG') setSavedScanId(null);
  }, []);

  const setNutrient = (key: keyof Nutrition, value: number) =>
    setForm((f) => ({
      ...f,
      nutrition: {
        ...f.nutrition,
        [key]: value,
        ...(key === 'sugar' && f.nutrition.addedSugar > value ? { addedSugar: value } : {}),
      },
    }));

  const payload = (f: FormState = form) => ({
    productName: f.productName.trim() || 'Untitled product',
    brand: f.brand.trim(),
    category: f.category,
    portionG: f.portionG,
    servingG: f.servingG,
    nutrition: f.nutrition,
    ingredients: f.ingredients,
    nova: f.nova,
  });

  const validate = (f: FormState = form) => {
    if (f.productName.trim().length < 2) return 'Give the product a name so you can find it later.';
    const n = f.nutrition;
    const anyValue = ['kcal', 'sugar', 'sodium', 'fat', 'carbs', 'protein', 'fiber'].some((k) => Number((n as any)[k]) > 0);
    if (!anyValue) return 'Enter at least a few values from the nutrition table.';
    if (f.portionG <= 0) return 'Portion size must be greater than 0.';
    return null;
  };

  const analyze = async (override?: FormState) => {
    const f = override ?? form;
    const problem = validate(f);
    if (problem) {
      setError(problem);
      return;
    }
    setError(null);
    setAnalyzing(true);
    try {
      const res = await api.scans.analyze(payload(f));
      setAnalysis(res.analysis);
      setAlternatives(res.alternatives);
      setAnalyzedPortion(f.portionG);
      setSavedScanId(null);
      setTab('overview');
      if (window.innerWidth < 1024) {
        setTimeout(() => resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 120);
      }
    } catch (e: any) {
      setError(e.message || 'Analysis failed. Check the values and try again.');
    } finally {
      setAnalyzing(false);
    }
  };

  const saveScan = async () => {
    if (!analysis) return;
    setSaving(true);
    try {
      const res = await api.scans.create({ ...payload(), notes: savedNotes });
      setSavedScanId(res.item.id);
      setAlternatives(res.alternatives);
      toast.success('Saved to your scan history', `${res.item.productName} · risk ${res.item.score}/100`);
    } catch (e: any) {
      toast.error('Could not save the scan', e.message);
    } finally {
      setSaving(false);
    }
  };

  const logToday = async () => {
    if (!analysis) return;
    setLogging(true);
    try {
      await api.logs.create({
        date: todayKey(),
        meal: logMeal,
        name: form.productName.trim() || 'Untitled product',
        portionG: form.portionG,
        nutrition: form.nutrition,
        score: analysis.score,
      });
      setLogOpen(false);
      toast.success(
        `Logged to ${logMeal}`,
        `${Math.round(form.portionG)} g · ${nf((analysis.perPortion as any).kcal)} kcal · sugar ${nf(analysis.perPortion.sugar, 1)} g`,
        { label: 'Open daily log', onClick: () => navigate('/log') }
      );
    } catch (e: any) {
      toast.error('Could not log this food', e.message);
    } finally {
      setLogging(false);
    }
  };

  /** Called by the camera modal with OCR'd (and user-reviewed) label text. */
  const handleCameraText = async (rawText: string) => {
    try {
      const res = await api.library.parseLabel(rawText);
      const nutrition = { ...form.nutrition, ...(res.nutrition as Partial<Nutrition>) } as Nutrition;
      const filled = Object.keys(res.nutrition || {}).length;
      const next: FormState = {
        ...form,
        nutrition,
        ingredients: res.ingredients || form.ingredients,
        servingG: res.servingG || form.servingG,
        portionG: res.servingG || form.portionG,
        nova: res.nova || form.nova,
        servingLabel: res.servingG ? `${res.servingG} g` : form.servingLabel,
      };
      setForm(next);
      setSavedScanId(null);
      setPasteText(rawText);

      if (filled >= 3 && next.productName.trim().length >= 2) {
        toast.success(`Read ${filled} values from the photo`, 'Scoring it against your health profile…');
        await analyze(next);
      } else if (filled >= 3) {
        toast.success(`Read ${filled} values from the photo`, 'Name the product, then press Analyse.');
        setTimeout(() => nameInputRef.current?.focus(), 250);
      } else {
        toast.error('We could only read a few values', 'Fix the fields below (or paste the label text) and analyse again.');
      }
    } catch (e: any) {
      toast.error('Could not read that label', e.message);
    }
  };

  const parsePasted = async () => {
    if (pasteText.trim().length < 8) {
      toast.error('Paste a little more of the label first');
      return;
    }
    setParsing(true);
    try {
      const res = await api.library.parseLabel(pasteText);
      const filled = Object.keys(res.nutrition || {}).length;
      setForm((f) => ({
        ...f,
        nutrition: { ...f.nutrition, ...res.nutrition } as Nutrition,
        ingredients: res.ingredients || f.ingredients,
        servingG: res.servingG || f.servingG,
        portionG: res.servingG || f.portionG,
        nova: res.nova || f.nova,
        servingLabel: res.servingG ? `${res.servingG} g` : f.servingLabel,
      }));
      setPasteOpen(false);
      setPasteText('');
      toast.success(
        `Read ${filled} values from the label`,
        res.ingredients ? 'Ingredient list captured too — check the fields before analysing.' : 'Check the values before analysing.'
      );
    } catch (e: any) {
      toast.error('Could not read that text', e.message);
    } finally {
      setParsing(false);
    }
  };

  const stale = analysis && analyzedPortion != null && analyzedPortion !== form.portionG;

  return (
    <div className="space-y-5">
      {/* ------------------------------------------------------------- header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-[26px] font-bold tracking-tight text-ink-900 sm:text-[30px]">Scan a nutrition label</h1>
          <p className="mt-1 max-w-2xl text-[13.5px] leading-relaxed text-ink-500">
            Paste the label, pull a product from your pantry, or type the values in. NutriLens reads the numbers
            <em className="not-italic font-medium text-ink-700"> and </em>
            the ingredient list, then translates them into what happens in your body.
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <Button icon={Camera} onClick={() => setCameraOpen(true)}>
            Scan with camera
          </Button>
          <Button variant="secondary" icon={ClipboardPaste} onClick={() => setPasteOpen(true)}>
            Smart paste
          </Button>
          <Button variant="ghost" icon={Package} onClick={() => navigate('/pantry')}>
            Pantry
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
        {/* ------------------------------------------------------------ form */}
        <div className="min-w-0 space-y-4">
          <Card>
            <CardHeader title="The product" subtitle="What are we looking at?" icon={Tag} />
            <div className="card-pad space-y-4">
              <CataloguePicker
                onPick={(p) => {
                  setForm({
                    productName: p.name,
                    brand: p.brand,
                    category: p.category,
                    servingG: p.servingG,
                    servingLabel: p.servingLabel,
                    portionG: p.servingG,
                    nova: p.nova,
                    nutrition: p.nutrition,
                    ingredients: p.ingredients,
                  });
                  setAnalysis(null);
                  setSavedScanId(null);
                  toast.info('Loaded from the NutriLens catalogue', 'Adjust the portion and analyse.');
                }}
              />

              <div className="grid grid-cols-1 grid gap-3 sm:grid-cols-2">
                <Field label="Product name">
                  <Input
                    ref={nameInputRef}
                    value={form.productName}
                    onChange={(e) => patch('productName', e.target.value)}
                    placeholder="e.g. Masala instant noodles"
                    invalid={!!error && form.productName.trim().length < 2}
                  />
                </Field>
                <Field label="Brand (optional)">
                  <Input value={form.brand} onChange={(e) => patch('brand', e.target.value)} placeholder="e.g. Nestlé" />
                </Field>
              </div>

              <div className="grid grid-cols-1 grid gap-3 sm:grid-cols-2">
                <Field label="Category">
                  <Select value={form.category} onChange={(e) => patch('category', e.target.value)}>
                    {(meta?.categories || []).map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.emoji} {c.label}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Serving size on the label" hint="Used to convert your portion into servings.">
                  <div className="relative">
                    <Input
                      type="number"
                      min={1}
                      value={form.servingG || ''}
                      onChange={(e) => patch('servingG', Number(e.target.value))}
                      className="pr-9"
                    />
                    <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[11px] font-medium text-ink-400">g/ml</span>
                  </div>
                </Field>
              </div>

              <Field label="Ingredients list" hint="Copy it exactly as printed — E-numbers, flavour enhancers and syrups are the interesting part.">
                <Textarea
                  value={form.ingredients}
                  onChange={(e) => patch('ingredients', e.target.value)}
                  placeholder="Refined wheat flour (maida), palm oil, salt, flavour enhancer (621), colour (150d)…"
                  className="min-h-[84px] text-[13px]"
                />
              </Field>

              <Field label="How processed is it? (NOVA class)">
                <Select value={form.nova} onChange={(e) => patch('nova', Number(e.target.value))}>
                  {NOVA_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </Select>
                <p className="mt-1.5 text-[11.5px] text-ink-400">{NOVA_OPTIONS.find((o) => o.value === form.nova)?.hint}</p>
              </Field>
            </div>
          </Card>

          <Card>
            <CardHeader
              title="Nutrition information"
              subtitle="Values per 100 g / 100 ml — that's what packs print"
              icon={FileText}
              action={
                <Button variant="ghost" size="sm" icon={ClipboardPaste} onClick={() => setPasteOpen(true)}>
                  Paste
                </Button>
              }
            />
            <div className="card-pad">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                <NumberField label="Energy" value={form.nutrition.kcal} onChange={(v) => setNutrient('kcal', v)} unit="kcal" />
                <NumberField label="Protein" value={form.nutrition.protein} onChange={(v) => setNutrient('protein', v)} unit="g" step={0.1} />
                <NumberField label="Carbohydrate" value={form.nutrition.carbs} onChange={(v) => setNutrient('carbs', v)} unit="g" step={0.1} />
                <NumberField label="Total sugar" value={form.nutrition.sugar} onChange={(v) => setNutrient('sugar', v)} unit="g" step={0.1} />
                <NumberField label="Added sugar" value={form.nutrition.addedSugar} onChange={(v) => setNutrient('addedSugar', v)} unit="g" step={0.1} />
                <NumberField label="Fibre" value={form.nutrition.fiber} onChange={(v) => setNutrient('fiber', v)} unit="g" step={0.1} />
                <NumberField label="Total fat" value={form.nutrition.fat} onChange={(v) => setNutrient('fat', v)} unit="g" step={0.1} />
                <NumberField label="Saturated fat" value={form.nutrition.satfat} onChange={(v) => setNutrient('satfat', v)} unit="g" step={0.1} />
                <NumberField label="Trans fat" value={form.nutrition.transFat} onChange={(v) => setNutrient('transFat', v)} unit="g" step={0.1} />
                <NumberField label="Sodium" value={form.nutrition.sodium} onChange={(v) => setNutrient('sodium', v)} unit="mg" />
              </div>

              <div className="mt-5 rounded-xl bg-ink-50/80 p-3.5">
                <div className="flex items-center justify-between text-[13px]">
                  <span className="font-medium text-ink-700">Your portion</span>
                  <span className="font-semibold tabular-nums text-ink-900">
                    {form.portionG} g
                    <span className="ml-1.5 font-normal text-ink-400">
                      ≈ {form.servingG > 0 ? (form.portionG / form.servingG).toFixed(1) : '—'} serving{(form.portionG / (form.servingG || 1)).toFixed(1) === '1.0' ? '' : 's'}
                    </span>
                  </span>
                </div>
                <input
                  type="range"
                  min={5}
                  max={Math.max(300, form.servingG * 4)}
                  step={5}
                  value={form.portionG}
                  onChange={(e) => patch('portionG', Number(e.target.value))}
                  className="mt-3 w-full"
                />
                <div className="mt-1 flex justify-between text-[10.5px] text-ink-400">
                  <span>5 g</span>
                  <span>1 serving = {form.servingG} g</span>
                  <span>{Math.max(300, form.servingG * 4)} g</span>
                </div>
              </div>

              {error && (
                <div className="mt-4 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-[13px] font-medium text-red-700">
                  <TriangleAlert size={15} className="mt-0.5 shrink-0" /> {error}
                </div>
              )}

              <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                <Button size="lg" block loading={analyzing} icon={Wand2} onClick={() => analyze()}>
                  {analyzing ? 'Reading the label…' : 'Analyse this food'}
                </Button>
                {analysis && stale && (
                  <Button size="lg" variant="secondary" onClick={() => analyze()} className="shrink-0">
                    Update for {form.portionG} g
                  </Button>
                )}
              </div>
            </div>
          </Card>
        </div>

        {/* --------------------------------------------------------- results */}
        <div ref={resultsRef} className="min-w-0 space-y-4 xl:sticky xl:top-6 xl:self-start">
          {loadingSaved ? (
            <Card className="card-pad space-y-3">
              <Skeleton className="h-6 w-40" />
              <Skeleton className="h-40 w-full" />
              <Skeleton className="h-4 w-2/3" />
            </Card>
          ) : analyzing ? (
            <ResultsSkeleton />
          ) : !analysis ? (
            <Card>
              <EmptyState
                icon={ScanLine}
                title="Your report will appear here"
                description="Fill in the label on the left (or hit Smart paste) and NutriLens will decode the nutrients, the additives and the long-term consequences for your health profile."
                action={
                  <div className="flex flex-wrap justify-center gap-2">
                    <Button icon={Camera} onClick={() => setCameraOpen(true)}>
                      Use the camera
                    </Button>
                    <Button variant="secondary" icon={ClipboardPaste} onClick={() => setPasteOpen(true)}>
                      Paste the label
                    </Button>
                  </div>
                }
              />
              <div className="grid grid-cols-1 grid gap-2 border-t border-ink-100 px-5 py-4 sm:grid-cols-3">
                {[
                  { icon: HeartPulse, label: 'What it does over time' },
                  { icon: Scale, label: 'How much is safe daily' },
                  { icon: Leaf, label: 'What to eat instead' },
                ].map((i) => (
                  <div key={i.label} className="flex items-center gap-2 text-[11.5px] text-ink-500">
                    <i.icon size={13} className="text-brand-500" /> {i.label}
                  </div>
                ))}
              </div>
            </Card>
          ) : (
            <>
              <ReportCard
                analysis={analysis}
                form={form}
                stale={!!stale}
                tab={tab}
                setTab={setTab}
                alternatives={alternatives}
                savedScanId={savedScanId}
                savedNotes={savedNotes}
                setSavedNotes={setSavedNotes}
                showNotes={showNotes}
                setShowNotes={setShowNotes}
                saving={saving}
                onSave={saveScan}
                onLog={() => setLogOpen(true)}
                onPortionChange={(v) => patch('portionG', v)}
              />
            </>
          )}
        </div>
      </div>

      {/* ---------------------------------------------------------- modals */}
      <CameraScan open={cameraOpen} onClose={() => setCameraOpen(false)} onText={handleCameraText} />

      <Modal
        open={pasteOpen}
        onClose={() => setPasteOpen(false)}
        title="Smart paste a nutrition label"
        description="Copy the nutrition table text (and ingredients) from a pack, a website or an OCR scan. We'll pull out the numbers."
        footer={
          <>
            <Button variant="secondary" onClick={() => setPasteOpen(false)}>Cancel</Button>
            <Button loading={parsing} icon={Wand2} onClick={parsePasted}>Read label</Button>
          </>
        }
      >
        <div className="space-y-3">
          <Textarea
            value={pasteText}
            onChange={(e) => setPasteText(e.target.value)}
            placeholder={`Nutrition Information (per 100 g)\nEnergy 450 kcal\nProtein 8 g\nTotal Fat 20 g\nSaturated Fat 9.2 g\nTrans Fat 0.2 g\nCarbohydrate 60 g\nTotal Sugars 12 g\nDietary Fibre 3 g\nSodium 480 mg\n\nIngredients: Refined wheat flour, sugar, palm oil, flavour enhancer (621)…`}
            className="min-h-[220px] font-mono text-[12px]"
          />
          <div className="flex items-start gap-2 rounded-xl bg-brand-50/70 px-3 py-2.5 text-[12px] leading-relaxed text-brand-800 ring-1 ring-inset ring-brand-100">
            <Info size={14} className="mt-0.5 shrink-0" />
            Values are treated as per 100 g. If the pack only lists "per serving", pairs are scaled automatically when a serving size is present.
          </div>
        </div>
      </Modal>

      <Modal
        open={logOpen}
        onClose={() => setLogOpen(false)}
        title="Log this to today"
        description="It will count against today's sugar, sodium and saturated-fat budget."
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setLogOpen(false)}>Cancel</Button>
            <Button loading={logging} icon={ClipboardList} onClick={logToday}>Add to daily log</Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="rounded-xl bg-ink-50 p-3.5">
            <p className="text-[13px] font-semibold text-ink-900">{form.productName || 'Untitled product'}</p>
            <p className="mt-0.5 text-[12px] text-ink-500">
              {form.portionG} g · {analysis ? `${nf((analysis.perPortion as any).kcal)} kcal · ${nf(analysis.perPortion.sugar, 1)} g sugar` : ''}
            </p>
          </div>
          <Field label="Which meal?">
            <div className="grid grid-cols-2 gap-2">
              {MEALS.map((m) => (
                <button
                  key={m.id}
                  onClick={() => setLogMeal(m.id as any)}
                  className={cn(
                    'rounded-xl border px-3 py-2.5 text-left text-[13px] font-medium transition',
                    logMeal === m.id ? 'border-brand-500 bg-brand-50 text-brand-800 ring-2 ring-brand-500/20' : 'border-ink-200 bg-white text-ink-600 hover:bg-ink-50'
                  )}
                >
                  {m.label}
                  <span className="block text-[11px] font-normal text-ink-400">{m.time}</span>
                </button>
              ))}
            </div>
          </Field>
        </div>
      </Modal>
    </div>
  );
}

/* ------------------------------------------------------- catalogue picker */
function CataloguePicker({ onPick }: { onPick: (p: Product) => void }) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const debounced = useDebounced(query, 250);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    api.catalogue
      .list(debounced)
      .then((r) => setItems(r.items))
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, [debounced, open]);

  return (
    <div className="relative">
      <Field label="Quick fill from the catalogue" hint="40+ packaged foods with real label values — or type your own below.">
        <div className="relative">
          <Search size={15} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-400" />
          <Input
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            placeholder="Search: maggi, cola, biscuits, oats…"
            className="pl-9 pr-16"
          />
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg px-2 py-1 text-[11px] font-semibold text-brand-700 hover:bg-brand-50"
          >
            Browse
          </button>
        </div>
      </Field>

      {open && (
        <>
          <div className="fixed inset-0 z-20" onClick={() => setOpen(false)} />
          <div className="absolute left-0 right-0 top-full z-30 mt-1.5 max-h-[300px] overflow-y-auto rounded-xl border border-ink-100 bg-white p-1.5 shadow-lift">
            {loading ? (
              <div className="flex items-center gap-2 px-3 py-4 text-[12.5px] text-ink-400">
                <Loader2 size={14} className="animate-spin" /> Searching catalogue…
              </div>
            ) : items.length === 0 ? (
              <p className="px-3 py-4 text-[12.5px] text-ink-400">Nothing matched. Type the values manually below.</p>
            ) : (
              items.map((p) => (
                <button
                  key={p.id}
                  onClick={() => {
                    onPick(p);
                    setOpen(false);
                    setQuery('');
                  }}
                  className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition hover:bg-ink-50"
                >
                  <span className="text-base">{p.emoji}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[12.5px] font-medium text-ink-800">{p.name}</span>
                    <span className="block truncate text-[11px] text-ink-400">
                      {p.brand || '—'} · {p.servingG} g serving
                    </span>
                  </span>
                  <span className={cn('shrink-0 rounded-md px-1.5 py-0.5 text-[11px] font-bold', TONE_CHIP[toneForScore(p.score)])}>{p.score}</span>
                </button>
              ))
            )}
          </div>
        </>
      )}
    </div>
  );
}

/* ------------------------------------------------------------ report card */
function ResultsSkeleton() {
  return (
    <Card className="card-pad space-y-5">
      <div className="flex items-center gap-4">
        <Skeleton className="h-28 w-28 rounded-full" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-2/3" />
          <Skeleton className="h-3 w-1/2" />
          <Skeleton className="h-3 w-1/3" />
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <Skeleton className="h-16" />
        <Skeleton className="h-16" />
        <Skeleton className="h-16" />
      </div>
      <div className="space-y-2.5">
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-11/12" />
        <Skeleton className="h-3 w-4/5" />
      </div>
      <p className="flex items-center justify-center gap-2 pt-1 text-[12px] font-medium text-ink-400">
        <Loader2 size={13} className="animate-spin" /> Running the numbers against your health profile…
      </p>
    </Card>
  );
}

function ReportCard({
  analysis, form, stale, tab, setTab, alternatives, savedScanId, savedNotes, setSavedNotes,
  showNotes, setShowNotes, saving, onSave, onLog, onPortionChange,
}: {
  analysis: Analysis;
  form: FormState;
  stale: boolean;
  tab: TabKey;
  setTab: (t: TabKey) => void;
  alternatives: Alternative[];
  savedScanId: number | null;
  savedNotes: string;
  setSavedNotes: (v: string) => void;
  showNotes: boolean;
  setShowNotes: (v: boolean) => void;
  saving: boolean;
  onSave: () => void;
  onLog: () => void;
  onPortionChange: (v: number) => void;
}) {
  const tone = toneForScore(analysis.score);
  const p = analysis.perPortion as any;

  const tabs: { key: TabKey; label: string; badge?: number }[] = [
    { key: 'overview', label: 'Overview' },
    { key: 'consequences', label: 'Effects', badge: analysis.consequences.length },
    { key: 'limits', label: 'Limits' },
    { key: 'ingredients', label: 'Additives', badge: analysis.additives.length || undefined },
    { key: 'swaps', label: 'Swaps', badge: alternatives.length || undefined },
  ];

  return (
    <Card className="flex max-h-[calc(100vh-2rem)] flex-col overflow-hidden xl:max-h-[calc(100vh-3rem)]">
      {/* header */}
      <div className="relative overflow-hidden border-b border-ink-100 bg-gradient-to-br from-white to-ink-50/60 px-5 py-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <ScoreRing score={analysis.score} size={124} stroke={10} label="risk score" animate />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <Chip tone={tone}>{analysis.verdict.label}</Chip>
              <Chip tone="slate" icon={Clock}>{analysis.frequency.text}</Chip>
              {stale && <Chip tone="amber" icon={Info}>re-analyse for {form.portionG} g</Chip>}
            </div>
            <h2 className="mt-2 font-display text-[19px] font-bold leading-tight tracking-tight text-ink-900">
              {form.productName || 'Untitled product'}
            </h2>
            <p className="mt-1 text-[12.5px] text-ink-500">
              {form.brand ? `${form.brand} · ` : ''}
              {Math.round(analysis.portionG)} g portion
              {analysis.servingG ? ` (${(analysis.portionG / analysis.servingG).toFixed(1)} × ${analysis.servingG} g serving)` : ''}
            </p>
            <p className="mt-2 text-[12.5px] leading-relaxed text-ink-500">{analysis.verdict.blurb}</p>
          </div>
        </div>

        {/* quick facts */}
        <div className="mt-4 grid grid-cols-3 gap-2">
          {([
            { label: 'Energy', value: nf(p.kcal), unit: 'kcal', tone: analysis.components.energy >= 55 ? 'orange' : 'emerald' },
            { label: 'Sugar', value: nf(p.sugar, 1), unit: 'g', tone: analysis.components.sugar >= 55 ? 'red' : analysis.components.sugar >= 35 ? 'amber' : 'emerald' },
            { label: 'Sodium', value: nf(p.sodium), unit: 'mg', tone: analysis.components.sodium >= 55 ? 'red' : analysis.components.sodium >= 35 ? 'amber' : 'emerald' },
          ] as { label: string; value: string; unit: string; tone: Tone }[]).map((f) => (
            <div key={f.label} className="rounded-xl bg-white px-3 py-2.5 shadow-ring">
              <p className="text-[10.5px] font-medium uppercase tracking-wide text-ink-400">{f.label}</p>
              <p className="mt-0.5 flex items-baseline gap-1">
                <span className={cn('font-display text-[17px] font-bold tabular-nums', TONE_TEXT[f.tone])}>{f.value}</span>
                <span className="text-[11px] text-ink-400">{f.unit}</span>
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* tabs */}
      <div className="flex shrink-0 gap-1 overflow-x-auto border-b border-ink-100 px-2 py-2">
        {tabs.map((t) => {
          const Icon = TAB_ICONS[t.key];
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={cn(
                'flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-2 text-[12.5px] font-semibold transition',
                tab === t.key ? 'bg-ink-950 text-white shadow-sm' : 'text-ink-500 hover:bg-ink-100 hover:text-ink-800'
              )}
            >
              <Icon size={13} />
              {t.label}
              {t.badge ? (
                <span className={cn('rounded-full px-1.5 py-0.5 text-[10px] font-bold', tab === t.key ? 'bg-white/20' : 'bg-ink-100 text-ink-500')}>
                  {t.badge}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
        {tab === 'overview' && <OverviewTab analysis={analysis} />}
        {tab === 'consequences' && <ConsequencesTab analysis={analysis} />}
        {tab === 'limits' && <LimitsTab analysis={analysis} onPortionChange={onPortionChange} />}
        {tab === 'ingredients' && <IngredientsTab analysis={analysis} ingredients={form.ingredients} />}
        {tab === 'swaps' && <SwapsTab alternatives={alternatives} analysis={analysis} />}
      </div>

      {/* actions */}
      <div className="shrink-0 space-y-3 border-t border-ink-100 bg-ink-50/50 px-5 py-4">
        {showNotes && (
          <Textarea
            value={savedNotes}
            onChange={(e) => setSavedNotes(e.target.value)}
            placeholder="Notes — where you ate it, how you felt, what you'll change…"
            className="min-h-[70px] bg-white text-[13px]"
          />
        )}
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button
            block
            variant={savedScanId ? 'secondary' : 'primary'}
            icon={savedScanId ? BookmarkCheck : Bookmark}
            loading={saving}
            onClick={onSave}
            disabled={!!savedScanId}
          >
            {savedScanId ? 'Saved to history' : 'Save to history'}
          </Button>
          <Button block variant="dark" icon={ClipboardList} onClick={onLog}>
            Log today
          </Button>
          <Button variant="ghost" size="md" icon={FileText} onClick={() => setShowNotes(!showNotes)} className="shrink-0">
            {showNotes ? 'Hide note' : 'Note'}
          </Button>
        </div>
      </div>
    </Card>
  );
}

/* ------------------------------------------------------------------- tabs */
function OverviewTab({ analysis }: { analysis: Analysis }) {
  const drivers = analysis.drivers.filter((d) => d.score > 25).slice(0, 4);
  return (
    <div className="space-y-5">
      {analysis.conditions.length > 0 && (
        <div className="space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-400">For your conditions</p>
          {analysis.conditions.map((c) => (
            <div
              key={c.id}
              className={cn(
                'rounded-xl border p-3',
                c.severity === 'high' ? 'border-red-200 bg-red-50/60' : c.severity === 'medium' ? 'border-amber-200 bg-amber-50/60' : 'border-emerald-200 bg-emerald-50/50'
              )}
            >
              <div className="flex items-center gap-2">
                <HeartPulse size={13} className={TONE_TEXT[severityTone(c.severity)]} />
                <p className="text-[12.5px] font-semibold text-ink-900">{c.label}</p>
                <Chip tone={severityTone(c.severity)} className="ml-auto">{SEVERITY_LABEL[c.severity]}</Chip>
              </div>
              <p className="mt-1 text-[12px] font-medium text-ink-600">{c.headline}</p>
              <p className="mt-1 text-[12px] leading-relaxed text-ink-500">{c.detail}</p>
            </div>
          ))}
        </div>
      )}

      {drivers.length > 0 && (
        <div>
          <p className="mb-2.5 text-[11px] font-semibold uppercase tracking-wider text-ink-400">What drives the score</p>
          <div className="space-y-2.5">
            {drivers.map((d) => (
              <div key={d.key}>
                <div className="flex items-baseline justify-between text-[12.5px]">
                  <span className="font-medium text-ink-700">{d.label}</span>
                  <span className="tabular-nums text-ink-400">{d.score}/100</span>
                </div>
                <Progress value={d.score} tone={d.score > 70 ? 'red' : d.score > 50 ? 'orange' : d.score > 30 ? 'amber' : 'emerald'} size="sm" className="mt-1" />
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-xl bg-ink-50 p-3">
          <p className="text-[11px] font-medium text-ink-400">Sugar per serving</p>
          <p className="mt-0.5 font-display text-[16px] font-bold text-ink-900">{analysis.estimates.teaspoonsSugarPerServing} tsp</p>
          <p className="text-[11px] text-ink-400">{analysis.estimates.energyFromSugarPct}% of the energy</p>
        </div>
        <div className="rounded-xl bg-ink-50 p-3">
          <p className="text-[11px] font-medium text-ink-400">Safe daily amount</p>
          <p className="mt-0.5 font-display text-[16px] font-bold text-ink-900">{analysis.dailyAllowance.grams} g</p>
          <p className="text-[11px] text-ink-400">≈ {analysis.dailyAllowance.servings} serving{analysis.dailyAllowance.servings === 1 ? '' : 's'}</p>
        </div>
      </div>

      {analysis.positives.length > 0 && (
        <div>
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-ink-400">What's good here</p>
          <div className="flex flex-wrap gap-1.5">
            {analysis.positives.map((p) => (
              <Chip key={p.key} tone="emerald" icon={Check}>{p.label}</Chip>
            ))}
          </div>
        </div>
      )}

      <div className="rounded-xl border border-ink-100 bg-white p-3.5">
        <p className="flex items-center gap-1.5 text-[12px] font-semibold text-ink-800">
          <Scale size={13} className="text-brand-600" /> Safe daily amount
        </p>
        <p className="mt-1.5 text-[12.5px] leading-relaxed text-ink-500">
          Your body can handle about <strong className="font-semibold text-ink-800">{analysis.dailyAllowance.grams} g</strong> of this per day
          without breaching a daily cap — that's <strong className="font-semibold text-ink-800">{analysis.dailyAllowance.servings} serving
          {analysis.dailyAllowance.servings === 1 ? '' : 's'}</strong>. The limiting nutrient is{' '}
          <strong className="font-semibold text-ink-800">{analysis.dailyAllowance.limitingNutrient?.toLowerCase()}</strong>. Best frequency:{' '}
          {analysis.frequency.text.toLowerCase()}.
        </p>
      </div>
    </div>
  );
}

function ConsequencesTab({ analysis }: { analysis: Analysis }) {
  return (
    <div className="space-y-3">
      <div className="flex items-start gap-2 rounded-xl bg-ink-950 p-3.5 text-white">
        <ShieldAlert size={16} className="mt-0.5 shrink-0 text-amber-300" />
        <p className="text-[12.5px] leading-relaxed text-white/70">
          Based on a <strong className="font-semibold text-white">{Math.round(analysis.portionG)} g portion</strong> eaten regularly.
          Effects are cumulative — none of this happens from one pack. That's exactly why labels are hard to read.
        </p>
      </div>
      {analysis.consequences.map((c) => (
        <div key={c.id} className="rounded-xl border border-ink-100 bg-white p-3.5">
          <div className="flex items-start gap-2">
            <span
              className={cn(
                'mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full',
                c.severity === 'high' ? 'bg-red-100 text-red-600' : c.severity === 'medium' ? 'bg-amber-100 text-amber-600' : 'bg-emerald-100 text-emerald-600'
              )}
            >
              {c.severity === 'high' ? <TriangleAlert size={13} /> : c.severity === 'medium' ? <AlertTriangle size={13} /> : <Check size={13} />}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h4 className="text-[13px] font-semibold leading-snug text-ink-900">{c.title}</h4>
                <Chip tone={severityTone(c.severity)} className="py-0.5 text-[10px]">{SEVERITY_LABEL[c.severity]}</Chip>
              </div>
              <p className="mt-1 flex items-center gap-1 text-[11px] font-medium text-ink-400">
                <Clock size={11} /> {c.horizon}
              </p>
              <p className="mt-1.5 text-[12.5px] leading-relaxed text-ink-600">{c.detail}</p>
              <p className="mt-2 border-l-2 border-ink-200 pl-2 text-[11px] leading-snug text-ink-400">{c.evidence}</p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function LimitsTab({ analysis, onPortionChange }: { analysis: Analysis; onPortionChange: (v: number) => void }) {
  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-brand-200 bg-gradient-to-br from-brand-50 to-lime-50 p-4">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-brand-700">How much you can have</p>
        <div className="mt-2 flex items-end gap-2">
          <span className="font-display text-[34px] font-bold leading-none tracking-tight text-ink-900">{analysis.dailyAllowance.grams}</span>
          <span className="pb-1 text-[13px] font-medium text-ink-500">g per day</span>
        </div>
        <p className="mt-1.5 text-[12.5px] leading-relaxed text-ink-600">
          ≈ <strong className="font-semibold">{analysis.dailyAllowance.servings}</strong> serving{analysis.dailyAllowance.servings === 1 ? '' : 's'} of{' '}
          {analysis.dailyAllowance.servingG} g · {analysis.dailyAllowance.frequency.toLowerCase()}
        </p>
        <p className="mt-1.5 text-[12px] text-ink-500">Limiting nutrient: <strong className="font-semibold text-ink-700">{analysis.dailyAllowance.limitingNutrient}</strong></p>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {[0.5, 1, 2].map((f) => {
            const g = Math.max(5, Math.round(analysis.dailyAllowance.servingG * f));
            return (
              <button
                key={f}
                onClick={() => onPortionChange(g)}
                className="rounded-lg bg-white/80 px-2.5 py-1 text-[11.5px] font-semibold text-brand-800 ring-1 ring-brand-200 transition hover:bg-white"
              >
                Try {g} g
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <p className="mb-2.5 text-[11px] font-semibold uppercase tracking-wider text-ink-400">This portion vs your daily caps</p>
        <NutrientBars
          items={analysis.dailyPercent
            .filter((d) => ['kcal', 'sugar', 'sodium', 'satfat', 'fiber', 'protein'].includes(d.key))
            .map((d) => ({ label: d.label, value: d.value, limit: d.limit, unit: d.unit, positive: d.positive }))}
        />
      </div>

      <div>
        <p className="mb-2.5 text-[11px] font-semibold uppercase tracking-wider text-ink-400">Where the cap comes from</p>
        <div className="overflow-hidden rounded-xl border border-ink-100">
          <table className="w-full text-[12px]">
            <thead className="bg-ink-50">
              <tr>
                <th className="px-3 py-2 text-left font-semibold text-ink-500">Nutrient</th>
                <th className="px-3 py-2 text-right font-semibold text-ink-500">Per 100 g</th>
                <th className="px-3 py-2 text-right font-semibold text-ink-500">Daily cap</th>
                <th className="px-3 py-2 text-right font-semibold text-ink-500">Max g/day</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100">
              {analysis.dailyAllowance.limiting.map((l) => (
                <tr key={l.key} className={l.isBinding ? 'bg-amber-50/50' : ''}>
                  <td className="px-3 py-2 font-medium text-ink-700">
                    {l.label}
                    {l.isBinding && <span className="ml-1.5 rounded bg-amber-100 px-1 py-0.5 text-[9.5px] font-bold uppercase text-amber-700">limit</span>}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-ink-600">{nf(l.per100, 1)} {l.unit}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-ink-500">{nf(l.limit)} {l.unit}</td>
                  <td className="px-3 py-2 text-right font-semibold tabular-nums text-ink-800">{nf(l.gramsAllowed)} g</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-[11px] leading-relaxed text-ink-400">
          Caps: 50 g free sugars, 2,000 mg sodium, 20 g saturated fat, 30 g fibre, 2,000 kcal per day for an average adult (WHO / ICMR-NIN). Your
          individual needs vary with body size and activity.
        </p>
      </div>
    </div>
  );
}

function IngredientsTab({ analysis, ingredients }: { analysis: Analysis; ingredients: string }) {
  const groups = [
    { level: 'high' as const, title: 'Worth avoiding', items: analysis.additives.filter((a) => a.level === 'high') },
    { level: 'medium' as const, title: 'Keep an eye on', items: analysis.additives.filter((a) => a.level === 'medium') },
    { level: 'low' as const, title: 'Low concern', items: analysis.additives.filter((a) => a.level === 'low') },
  ].filter((g) => g.items.length);

  return (
    <div className="space-y-5">
      {analysis.additives.length === 0 ? (
        <EmptyState
          compact
          icon={BadgeCheck}
          title="No additives of concern"
          description="We found no E-numbers, flavour enhancers or industrial fats in the ingredient list. That's genuinely rare for packaged food."
        />
      ) : (
        groups.map((g) => (
          <div key={g.level}>
            <div className="mb-2 flex items-center gap-2">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-400">{g.title}</p>
              <span className={cn('rounded-full px-1.5 py-0.5 text-[10px] font-bold', TONE_CHIP[severityTone(g.level)])}>{g.items.length}</span>
            </div>
            <div className="space-y-2">
              {g.items.map((a) => (
                <div key={a.code} className="rounded-xl border border-ink-100 bg-white p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-[12.5px] font-semibold text-ink-900">{a.name}</p>
                      <p className="text-[11px] text-ink-400">
                        {a.category}
                        {/^[0-9]/.test(a.code) ? ` · INS ${a.code.toUpperCase()}` : ''}
                      </p>
                    </div>
                    <Chip tone={severityTone(a.level)} className="shrink-0 capitalize">{a.level}</Chip>
                  </div>
                  <p className="mt-1.5 text-[12px] leading-relaxed text-ink-600">{a.what}</p>
                  <p className="mt-1 text-[12px] leading-relaxed text-ink-500">
                    <span className="font-medium text-ink-700">Why it matters: </span>
                    {a.why}
                  </p>
                </div>
              ))}
            </div>
          </div>
        ))
      )}

      {analysis.ingredientFlags.length > 0 && (
        <div>
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-ink-400">Read between the lines</p>
          <div className="space-y-2">
            {analysis.ingredientFlags.map((f) => (
              <div key={f.label} className="rounded-xl bg-ink-50 p-3">
                <p className="text-[12.5px] font-semibold text-ink-800">{f.label}</p>
                <p className="mt-0.5 text-[12px] leading-relaxed text-ink-500">{f.note}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {ingredients && (
        <div>
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-ink-400">In the pack's own words</p>
          <p className="rounded-xl border border-dashed border-ink-200 bg-white p-3 font-mono text-[11.5px] leading-relaxed text-ink-500">
            {ingredients}
          </p>
        </div>
      )}
    </div>
  );
}

function SwapsTab({ alternatives, analysis }: { alternatives: Alternative[]; analysis: Analysis }) {
  if (!alternatives.length) {
    return (
      <EmptyState
        icon={Leaf}
        title="No swaps needed"
        description="This food already scores well enough that we couldn't find a meaningfully better replacement in the same category."
      />
    );
  }
  return (
    <div className="space-y-3">
      <div className="rounded-xl bg-brand-50/70 p-3.5 ring-1 ring-inset ring-brand-100">
        <p className="flex items-center gap-1.5 text-[12.5px] font-semibold text-brand-800">
          <Leaf size={13} /> Healthier alternatives
        </p>
        <p className="mt-1 text-[12px] leading-relaxed text-brand-700/80">
          Same craving, better physiology. Each option is scored with the same engine so you can compare like for like.
        </p>
      </div>
      {alternatives.map((a) => (
        <div key={a.id} className="rounded-xl border border-ink-100 bg-white p-3.5">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-ink-50 text-xl">{a.emoji}</span>
            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-[13px] font-semibold leading-snug text-ink-900">{a.name}</p>
                  <p className="text-[11px] text-ink-400">{a.brand || 'Any brand'}</p>
                </div>
                <div className="flex shrink-0 flex-col items-end">
                  <Chip tone={toneForScore(a.score)}>{a.score}</Chip>
                  {a.improvement ? <span className="mt-1 text-[10.5px] font-semibold text-emerald-600">−{a.improvement} pts</span> : null}
                </div>
              </div>
              <p className="mt-1.5 text-[12px] leading-relaxed text-ink-600">{a.description}</p>
              <p className="mt-1 text-[12px] leading-relaxed text-ink-500">
                <span className="font-medium text-ink-700">Why it's better: </span>
                {a.swapReason}
              </p>
              {a.deltas && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {a.deltas.sugar > 10 && <Chip tone="emerald">−{a.deltas.sugar}% sugar</Chip>}
                  {a.deltas.sodium > 10 && <Chip tone="emerald">−{a.deltas.sodium}% sodium</Chip>}
                  {a.deltas.satfat >= 99 ? <Chip tone="emerald">no saturated fat</Chip> : a.deltas.satfat > 10 ? <Chip tone="emerald">−{a.deltas.satfat}% sat fat</Chip> : null}
                  {a.deltas.kcal > 10 && <Chip tone="emerald">−{a.deltas.kcal}% kcal</Chip>}
                  {a.deltas.fiber > 10 && <Chip tone="emerald">+{a.deltas.fiber}% fibre</Chip>}
                </div>
              )}
            </div>
          </div>
        </div>
      ))}
      <p className="pt-1 text-center text-[11px] text-ink-400">
        Compared against {analysis.verdict.label.toLowerCase()} · {analysis.score}/100
      </p>
    </div>
  );
}
