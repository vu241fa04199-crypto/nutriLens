import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowRight, Download, Loader2, Package, Pencil, Plus, ScanLine, Search, SlidersHorizontal, Trash2, TriangleAlert, X,
} from 'lucide-react';
import { api } from '../lib/api';
import type { ProductPayload } from '../lib/api';
import { useToast } from '../context/ToastContext';
import type { Meta, Nutrition, Product } from '../lib/types';
import {
  Button, Card, Chip, EmptyState, Field, Input, Modal, NumberField, Select, Skeleton, Textarea,
} from '../components/ui';
import {
  cn, emptyNutrition, estimateScore, nf, NOVA_OPTIONS, toneForScore, verdictLabel,
} from '../lib/utils';

const EMOJIS = ['🍽️', '🍜', '🥔', '🥤', '🍪', '🍫', '🧀', '🥣', '🥫', '🍞', '🌾', '💪', '🍬', '🥜', '🥗', '🍿', '🧃', '☕'];

const blankForm = () => ({
  name: '',
  brand: '',
  category: 'snack',
  emoji: '🍽️',
  servingG: 30,
  servingLabel: '',
  nova: 4,
  ingredients: '',
  notes: '',
  nutrition: emptyNutrition() as Nutrition,
});

type FormState = ReturnType<typeof blankForm>;

export default function Pantry() {
  const navigate = useNavigate();
  const toast = useToast();

  const [items, setItems] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [meta, setMeta] = useState<Meta | null>(null);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('all');
  const [sort, setSort] = useState('recent');

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [form, setForm] = useState<FormState>(blankForm());
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<Product | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const [importOpen, setImportOpen] = useState(false);
  const [importItems, setImportItems] = useState<Product[]>([]);
  const [importLoading, setImportLoading] = useState(false);
  const [importingId, setImportingId] = useState<number | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.products.list();
      setItems(res.items);
    } catch (e: any) {
      toast.error('Could not load your pantry', e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    api.meta().then(setMeta).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = useMemo(() => {
    let list = [...items];
    if (query.trim()) {
      const q = query.toLowerCase();
      list = list.filter((p) => `${p.name} ${p.brand}`.toLowerCase().includes(q));
    }
    if (category !== 'all') list = list.filter((p) => p.category === category);
    if (sort === 'score') list.sort((a, b) => b.score - a.score);
    if (sort === 'score_asc') list.sort((a, b) => a.score - b.score);
    if (sort === 'name') list.sort((a, b) => a.name.localeCompare(b.name));
    return list;
  }, [items, query, category, sort]);

  /* --------------------------------------------------------------- create */
  const openCreate = () => {
    setEditing(null);
    setForm(blankForm());
    setFormError(null);
    setFormOpen(true);
  };

  const openEdit = (p: Product) => {
    setEditing(p);
    setForm({
      name: p.name,
      brand: p.brand,
      category: p.category,
      emoji: p.emoji || '🍽️',
      servingG: p.servingG,
      servingLabel: p.servingLabel,
      nova: p.nova,
      ingredients: p.ingredients,
      notes: p.notes || '',
      nutrition: { ...emptyNutrition(), ...p.nutrition },
    });
    setFormError(null);
    setFormOpen(true);
  };

  const validate = () => {
    if (form.name.trim().length < 2) return 'Give the product a name.';
    if (form.servingG <= 0) return 'Serving size must be greater than 0.';
    if (!Number.isFinite(form.nutrition.kcal) || form.nutrition.kcal > 1000) return 'Energy per 100 g must be under 1000 kcal.';
    return null;
  };

  const save = async () => {
    const problem = validate();
    if (problem) {
      setFormError(problem);
      return;
    }
    setSaving(true);
    setFormError(null);
    const payload: ProductPayload = {
      name: form.name.trim(),
      brand: form.brand.trim(),
      category: form.category,
      servingG: form.servingG,
      servingLabel: form.servingLabel || `${form.servingG} g`,
      nutrition: form.nutrition,
      ingredients: form.ingredients,
      nova: form.nova,
      emoji: form.emoji,
      notes: form.notes,
    };

    if (editing) {
      const previous = items;
      const optimistic: Product = { ...editing, ...payload, score: estimateScore(payload.nutrition, payload.nova), verdict: editing.verdict };
      setItems((list) => list.map((p) => (p.id === editing.id ? optimistic : p)));
      setFormOpen(false);
      try {
        const res = await api.products.update(editing.id, payload);
        setItems((list) => list.map((p) => (p.id === editing.id ? res.item : p)));
        toast.success('Product updated', res.item.name);
      } catch (e: any) {
        setItems(previous);
        toast.error('Update failed', e.message);
      } finally {
        setSaving(false);
      }
      return;
    }

    const tempId = -Date.now();
    const optimistic: Product = {
      id: tempId,
      ...payload,
      servingLabel: payload.servingLabel || `${payload.servingG} g`,
      additives: [],
      emoji: payload.emoji || '🍽️',
      notes: payload.notes || '',
      score: estimateScore(payload.nutrition, payload.nova),
      verdict: { max: 100, key: 'caution', label: verdictLabel(estimateScore(payload.nutrition, payload.nova)), tone: 'amber', blurb: '' },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    setItems((list) => [optimistic, ...list]);
    setFormOpen(false);
    try {
      const res = await api.products.create(payload);
      setItems((list) => list.map((p) => (p.id === tempId ? res.item : p)));
      toast.success('Added to your pantry', `${res.item.name} · risk ${res.item.score}/100`);
    } catch (e: any) {
      setItems((list) => list.filter((p) => p.id !== tempId));
      toast.error('Could not save the product', e.message);
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleting) return;
    setDeleteLoading(true);
    const previous = items;
    setItems((list) => list.filter((p) => p.id !== deleting.id));
    try {
      await api.products.remove(deleting.id);
      toast.success('Product removed', deleting.name);
      setDeleting(null);
    } catch (e: any) {
      setItems(previous);
      toast.error('Could not delete', e.message);
    } finally {
      setDeleteLoading(false);
    }
  };

  const openImport = async () => {
    setImportOpen(true);
    if (importItems.length) return;
    setImportLoading(true);
    try {
      const res = await api.catalogue.list('');
      setImportItems(res.items);
    } catch (e: any) {
      toast.error('Could not load the catalogue', e.message);
    } finally {
      setImportLoading(false);
    }
  };

  const importOne = async (p: Product) => {
    setImportingId(p.id);
    try {
      const res = await api.catalogue.import(p.id);
      setItems((list) => [res.item, ...list]);
      toast.success('Saved to your pantry', res.item.name);
    } catch (e: any) {
      toast.error('Import failed', e.message);
    } finally {
      setImportingId(null);
    }
  };

  return (
    <div className="space-y-5">
      {/* header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-[26px] font-bold tracking-tight text-ink-900 sm:text-[30px]">My pantry</h1>
          <p className="mt-1 max-w-xl text-[13.5px] leading-relaxed text-ink-500">
            The packaged foods you actually eat. Save them once and every future scan, log and comparison gets faster.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" icon={Download} onClick={openImport}>
            Catalogue
          </Button>
          <Button icon={Plus} onClick={openCreate}>
            Add product
          </Button>
        </div>
      </div>

      {/* toolbar */}
      <Card className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search size={15} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-400" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search your pantry…"
            className="border-transparent bg-ink-50/70 pl-9 focus:bg-white"
          />
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <SlidersHorizontal size={13} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
            <Select value={category} onChange={(e) => setCategory(e.target.value)} className="w-[168px] border-transparent bg-ink-50/70 pl-8 text-[13px] focus:bg-white">
              <option value="all">All categories</option>
              {(meta?.categories || []).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.emoji} {c.label}
                </option>
              ))}
            </Select>
          </div>
          <Select value={sort} onChange={(e) => setSort(e.target.value)} className="w-[150px] border-transparent bg-ink-50/70 text-[13px] focus:bg-white">
            <option value="recent">Recently updated</option>
            <option value="score">Highest risk</option>
            <option value="score_asc">Lowest risk</option>
            <option value="name">Name A–Z</option>
          </Select>
        </div>
      </Card>

      {/* content */}
      {loading ? (
        <div className="grid grid-cols-1 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i} className="card-pad space-y-3">
              <div className="flex items-center gap-3">
                <Skeleton className="h-11 w-11 rounded-xl" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-3.5 w-2/3" />
                  <Skeleton className="h-3 w-1/3" />
                </div>
              </div>
              <Skeleton className="h-2 w-full" />
              <Skeleton className="h-2 w-4/5" />
              <Skeleton className="h-8 w-full" />
            </Card>
          ))}
        </div>
      ) : items.length === 0 ? (
        <Card>
          <EmptyState
            icon={Package}
            title="Your pantry is empty"
            description="Add the packaged foods you keep at home, or pull a few from the NutriLens catalogue — 27 real products with label values filled in."
            action={
              <div className="flex flex-wrap justify-center gap-2">
                <Button icon={Plus} onClick={openCreate}>Add a product</Button>
                <Button variant="secondary" icon={Download} onClick={openImport}>Browse catalogue</Button>
              </div>
            }
          />
        </Card>
      ) : filtered.length === 0 ? (
        <Card>
          <EmptyState
            icon={Search}
            title="Nothing matches that filter"
            description={`No products match "${query || category}". Try clearing the search.`}
            action={
              <Button
                variant="secondary"
                icon={X}
                onClick={() => {
                  setQuery('');
                  setCategory('all');
                }}
              >
                Clear filters
              </Button>
            }
          />
        </Card>
      ) : (
        <>
          <div className="flex items-center justify-between px-1">
            <p className="text-[12.5px] text-ink-400">
              {filtered.length} of {items.length} product{items.length === 1 ? '' : 's'}
            </p>
            <p className="hidden items-center gap-1.5 text-[11.5px] text-ink-400 sm:flex">
              <TriangleAlert size={12} /> Scores are per 100 g and personalised to your conditions on the Scan page
            </p>
          </div>
          <div className="grid grid-cols-1 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {filtered.map((p) => (
              <ProductCard
                key={p.id}
                product={p}
                onScan={() => navigate(`/scan?product=${p.id}`)}
                onEdit={() => openEdit(p)}
                onDelete={() => setDeleting(p)}
                categoryLabel={meta?.categories.find((c) => c.id === p.category)?.label || p.category}
              />
            ))}
          </div>
        </>
      )}

      {/* create / edit modal */}
      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        size="lg"
        title={editing ? 'Edit product' : 'Add a product'}
        description="Copy the values from the pack. Per 100 g makes everything comparable."
        footer={
          <>
            <Button variant="secondary" onClick={() => setFormOpen(false)}>Cancel</Button>
            <Button loading={saving} onClick={save} icon={editing ? Pencil : Plus}>
              {editing ? 'Save changes' : 'Add to pantry'}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="grid grid-cols-1 grid gap-3 sm:grid-cols-2">
            <Field label="Product name" error={formError && form.name.trim().length < 2 ? formError : null}>
              <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="e.g. Cheese slices" />
            </Field>
            <Field label="Brand">
              <Input value={form.brand} onChange={(e) => setForm((f) => ({ ...f, brand: e.target.value }))} placeholder="e.g. Amul" />
            </Field>
          </div>

          <div className="grid grid-cols-1 grid gap-3 sm:grid-cols-3">
            <Field label="Category">
              <Select value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}>
                {(meta?.categories || []).map((c) => (
                  <option key={c.id} value={c.id}>{c.emoji} {c.label}</option>
                ))}
              </Select>
            </Field>
            <Field label="Serving size">
              <Input
                type="number"
                min={1}
                value={form.servingG || ''}
                onChange={(e) => setForm((f) => ({ ...f, servingG: Number(e.target.value) }))}
                placeholder="30"
              />
            </Field>
            <Field label="NOVA class">
              <Select value={form.nova} onChange={(e) => setForm((f) => ({ ...f, nova: Number(e.target.value) }))}>
                {NOVA_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </Select>
            </Field>
          </div>

          <Field label="Icon">
            <div className="flex flex-wrap gap-1.5">
              {EMOJIS.map((e) => (
                <button
                  key={e}
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, emoji: e }))}
                  className={cn(
                    'flex h-9 w-9 items-center justify-center rounded-lg text-lg transition',
                    form.emoji === e ? 'bg-brand-100 ring-2 ring-brand-500' : 'bg-ink-50 hover:bg-ink-100'
                  )}
                >
                  {e}
                </button>
              ))}
            </div>
          </Field>

          <div>
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-ink-400">Nutrition per 100 g</p>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {([
                ['kcal', 'Energy', 'kcal'],
                ['protein', 'Protein', 'g'],
                ['carbs', 'Carbohydrate', 'g'],
                ['sugar', 'Total sugar', 'g'],
                ['addedSugar', 'Added sugar', 'g'],
                ['fiber', 'Fibre', 'g'],
                ['fat', 'Total fat', 'g'],
                ['satfat', 'Saturated fat', 'g'],
                ['transFat', 'Trans fat', 'g'],
                ['sodium', 'Sodium', 'mg'],
              ] as [keyof Nutrition, string, string][]).map(([key, label, unit]) => (
                <NumberField
                  key={key}
                  label={label}
                  unit={unit}
                  value={form.nutrition[key]}
                  onChange={(v) => setForm((f) => ({ ...f, nutrition: { ...f.nutrition, [key]: v } }))}
                />
              ))}
            </div>
          </div>

          <Field label="Ingredients" hint="Paste the list — additives are auto-detected when you analyse.">
            <Textarea
              value={form.ingredients}
              onChange={(e) => setForm((f) => ({ ...f, ingredients: e.target.value }))}
              placeholder="Wheat flour, palm oil, salt, flavour enhancer (621)…"
              className="text-[13px]"
            />
          </Field>

          <Field label="Private notes">
            <Input value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} placeholder="Why you keep it, how often you eat it…" />
          </Field>

          {formError && (
            <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-[13px] font-medium text-red-700">
              <TriangleAlert size={14} /> {formError}
            </div>
          )}
        </div>
      </Modal>

      {/* delete modal */}
      <Modal
        open={!!deleting}
        onClose={() => setDeleting(null)}
        size="sm"
        title="Remove this product?"
        description="Scan history and daily logs stay intact — only the pantry entry is removed."
        footer={
          <>
            <Button variant="secondary" onClick={() => setDeleting(null)}>Keep it</Button>
            <Button variant="danger" loading={deleteLoading} icon={Trash2} onClick={confirmDelete}>
              Remove
            </Button>
          </>
        }
      >
        {deleting && (
          <div className="flex items-center gap-3 rounded-xl bg-ink-50 p-3.5">
            <span className="text-2xl">{deleting.emoji}</span>
            <div>
              <p className="text-[13px] font-semibold text-ink-900">{deleting.name}</p>
              <p className="text-[12px] text-ink-500">{deleting.brand || 'No brand'} · risk {deleting.score}/100</p>
            </div>
          </div>
        )}
      </Modal>

      {/* catalogue modal */}
      <Modal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        size="lg"
        title="NutriLens catalogue"
        description="Real label values for popular packaged foods. One click copies it into your pantry."
      >
        {importLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-14 w-full" />
            ))}
          </div>
        ) : (
          <div className="space-y-2">
            {importItems.map((p) => (
              <div key={p.id} className="flex items-center gap-3 rounded-xl border border-ink-100 p-2.5">
                <span className="text-xl">{p.emoji}</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[12.5px] font-semibold text-ink-900">{p.name}</p>
                  <p className="truncate text-[11px] text-ink-400">
                    {p.brand || '—'} · {p.servingG} g serving · {nf(p.nutrition.kcal)} kcal/100 g
                  </p>
                </div>
                <Chip tone={toneForScore(p.score)}>{p.score}</Chip>
                <Button
                  size="sm"
                  variant="secondary"
                  loading={importingId === p.id}
                  onClick={() => importOne(p)}
                  icon={Plus}
                >
                  Add
                </Button>
              </div>
            ))}
          </div>
        )}
      </Modal>
    </div>
  );
}

function ProductCard({
  product, onScan, onEdit, onDelete, categoryLabel,
}: {
  product: Product;
  onScan: () => void;
  onEdit: () => void;
  onDelete: () => void;
  categoryLabel: string;
}) {
  const tone = toneForScore(product.score);
  const n = product.nutrition;
  const pending = product.id < 0;
  return (
    <Card className={cn('group flex flex-col transition-shadow hover:shadow-lift', pending && 'opacity-70')}>
      <div className="flex items-start gap-3 p-4 pb-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-ink-50 text-xl">{product.emoji}</span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13.5px] font-semibold leading-snug text-ink-900">{product.name}</p>
          <p className="truncate text-[11.5px] text-ink-400">
            {product.brand || 'No brand'} · {categoryLabel}
          </p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <Chip tone={tone}>{pending ? '…' : product.score}</Chip>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-1 px-4 pb-3">
        {[
          { label: 'kcal', value: nf(n.kcal) },
          { label: 'sugar', value: `${nf(n.sugar, 1)} g` },
          { label: 'sodium', value: `${nf(n.sodium)} mg` },
        ].map((s) => (
          <div key={s.label} className="rounded-lg bg-ink-50/70 px-2 py-1.5">
            <p className="text-[9.5px] font-medium uppercase tracking-wide text-ink-400">{s.label}</p>
            <p className="text-[12px] font-semibold tabular-nums text-ink-800">{s.value}</p>
          </div>
        ))}
      </div>

      {product.notes && <p className="mx-4 mb-3 line-clamp-2 text-[11.5px] italic leading-snug text-ink-400">"{product.notes}"</p>}

      <div className="mt-auto flex items-center gap-1.5 border-t border-ink-100 p-2.5">
        <Button size="sm" variant="secondary" icon={ScanLine} onClick={onScan} className="flex-1">
          Scan
        </Button>
        <Button size="sm" variant="ghost" onClick={onEdit} aria-label="Edit" title="Edit">
          <Pencil size={14} />
        </Button>
        <Button size="sm" variant="ghost" onClick={onDelete} aria-label="Delete" title="Delete" className="text-ink-400 hover:bg-red-50 hover:text-red-600">
          <Trash2 size={14} />
        </Button>
      </div>
    </Card>
  );
}
