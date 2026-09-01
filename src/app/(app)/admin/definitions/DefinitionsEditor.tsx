'use client';

import { useState, useTransition, type CSSProperties } from 'react';
import { useRouter } from 'next/navigation';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
import Select from '@/components/ui/Select';
import TagInput from '@/components/ui/TagInput';
import ChoicesEditor from '@/components/ui/ChoicesEditor';
import TabsEditor from '@/components/ui/TabsEditor';
import DataTable, { type Column } from '@/components/ui/DataTable';
import EmptyState from '@/components/ui/EmptyState';
import { NODE_ICON_NAMES, NodeTypeIcon } from '@/lib/views/icons';
import { useConfirm } from '@/components/ui/Confirm';
import { getChoices } from '@/lib/definitions/choices';
import type { ChoiceOption, DefinitionRow, EdgePair, FieldDef, TabSpec } from '@/lib/supabase/types';
import { saveDefinition, createDefinition, deleteDefinition } from '@/lib/definitions/actions';
import AdminNav from '../AdminNav';

const DATA_TYPES = ['text', 'number', 'enum', 'date', 'boolean', 'richtext', 'user', 'users'] as const;
const DATA_TYPE_LABELS: Record<(typeof DATA_TYPES)[number], string> = {
  text: 'text',
  number: 'number',
  enum: 'enum',
  date: 'date',
  boolean: 'boolean',
  richtext: 'richtext',
  user: 'user',
  users: 'users (multi)',
};
const isUserType = (t: FieldDef['data_type']) => t === 'user' || t === 'users';

interface Draft {
  key: string;
  label: string;
  data_type: FieldDef['data_type'];
  required: boolean;
  filterable: boolean;
  forYou: boolean;
  choices: ChoiceOption[];
  min: string;
  max: string;
  labels: string[];
}

function toDraft(f: FieldDef): Draft {
  return {
    key: f.key,
    label: f.label,
    data_type: f.data_type,
    required: !!f.required,
    filterable: !!f.filterable,
    forYou: !!f.forYou,
    choices: getChoices(f),
    min: f.options?.min != null ? String(f.options.min) : '',
    max: f.options?.max != null ? String(f.options.max) : '',
    labels: f.options?.labels ?? [],
  };
}

function toField(d: Draft, i: number): FieldDef {
  const options: NonNullable<FieldDef['options']> = {};
  if (d.data_type === 'enum') {
    options.choices = d.choices;
  }
  if (d.data_type === 'number') {
    if (d.min !== '') options.min = Number(d.min);
    if (d.max !== '') options.max = Number(d.max);
    if (d.labels.length) options.labels = d.labels;
  }
  return {
    key: d.key.trim(),
    label: d.label.trim(),
    data_type: d.data_type,
    required: d.required || undefined,
    filterable: d.filterable || undefined,
    forYou: (isUserType(d.data_type) && d.forYou) || undefined,
    position: i,
    options: Object.keys(options).length ? options : undefined,
  };
}

export default function DefinitionsEditor({ definitions }: { definitions: DefinitionRow[] }) {
  const [editing, setEditing] = useState<DefinitionRow | null>(null);
  const [viewing, setViewing] = useState<DefinitionRow | null>(null);
  const [creating, setCreating] = useState(false);
  const router = useRouter();
  const confirm = useConfirm();
  const [, startTransition] = useTransition();

  const nodes = definitions.filter((d) => d.kind === 'node');
  const edges = definitions.filter((d) => d.kind === 'edge');
  // Node-type options for the edge pairs editor (plus the `*` wildcard).
  const nodeOptions = [
    ...nodes.map((n) => ({ value: n.key, label: `${n.label} (${n.key})` })),
    { value: '*', label: 'Any (*)' },
  ];
  const defsMap = Object.fromEntries(definitions.map((d) => [d.key, d]));

  async function remove(def: DefinitionRow) {
    const ok = await confirm({
      title: 'Delete type',
      body: `Delete the “${def.label}” type? Existing records of this type are not removed but lose their definition.`,
      confirmLabel: 'Delete',
      danger: true,
    });
    if (!ok) return;
    startTransition(async () => {
      await deleteDefinition(def.id);
      router.refresh();
    });
  }

  return (
    <div>
      <p className="eyebrow rv">Admin</p>
      <div className="flex items-end justify-between gap-6 flex-wrap">
        <h1 className="view-title rv" style={{ '--i': 1 } as CSSProperties}>Definitions</h1>
        <span className="rv" style={{ '--i': 2 } as CSSProperties}>
          <Button variant="primary" size="sm" onClick={() => setCreating(true)}>New type</Button>
        </span>
      </div>
      <p className="lede rv" style={{ '--i': 2 } as CSSProperties}>
        The node &amp; edge type registry — every form, filter, table and RED editor in the
        app is generated from what&rsquo;s configured here. Renaming a field&rsquo;s key or
        removing a choice can orphan existing records&rsquo; data, so change with care.
      </p>

      <AdminNav />

      <div className="mt-10 rv" style={{ '--i': 3 } as CSSProperties}>
        <TypeSection title="Node types" items={nodes} onEdit={setEditing} onViews={setViewing} onRemove={remove} />
        <TypeSection title="Edge types" items={edges} onEdit={setEditing} onRemove={remove} />
      </div>

      {editing && <EditModal definition={editing} nodeOptions={nodeOptions} onClose={() => setEditing(null)} />}
      {viewing && <ViewsModal definition={viewing} defs={defsMap} onClose={() => setViewing(null)} />}
      {creating && <CreateModal onClose={() => setCreating(false)} />}
    </div>
  );
}

function TypeSection({
  title,
  items,
  onEdit,
  onViews,
  onRemove,
}: {
  title: string;
  items: DefinitionRow[];
  onEdit: (d: DefinitionRow) => void;
  onViews?: (d: DefinitionRow) => void;
  onRemove: (d: DefinitionRow) => void;
}) {
  const cols: Column<DefinitionRow>[] = [
    {
      key: 'label',
      header: 'Type',
      cell: (def) => (
        <div>
          <div style={{ color: 'var(--fg)', fontWeight: 500 }}>{def.label}</div>
          <div className="mono" style={{ fontSize: 11, color: 'var(--muted)' }}>{def.key}</div>
        </div>
      ),
      sortValue: (def) => def.label.toLowerCase(),
    },
    {
      key: 'fields',
      header: 'Fields',
      mono: true,
      cellStyle: { color: 'var(--muted)' },
      cell: (def) => {
        const n = (((def.config ?? {}) as { fields?: unknown[] }).fields ?? []).length;
        return `${n} field${n === 1 ? '' : 's'}`;
      },
      sortValue: (def) => (((def.config ?? {}) as { fields?: unknown[] }).fields ?? []).length,
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      cell: (def) => (
        <div className="flex items-center gap-4 justify-end">
          {onViews && (
            <button type="button" className="muted-link" onClick={() => onViews(def)}>
              Views
            </button>
          )}
          <button type="button" className="muted-link" onClick={() => onEdit(def)}>
            Edit
          </button>
          <button type="button" className="muted-link" onClick={() => onRemove(def)}>
            Delete
          </button>
        </div>
      ),
    },
  ];
  return (
    <section className="mb-10">
      <div className="flex items-center gap-3 mb-3">
        <span className="zone-label">{title}</span>
        <span className="flex-1 divider" aria-hidden />
      </div>
      {items.length === 0 ? (
        <EmptyState eyebrow={title} title={`No ${title.toLowerCase()} yet`} description="Create one with New type, above." />
      ) : (
        <DataTable columns={cols} rows={items} getRowKey={(d) => d.id} empty="None." />
      )}
    </section>
  );
}

function crossProduct(from: string[], to: string[]): EdgePair[] {
  const out: EdgePair[] = [];
  for (const f of from) for (const t of to) out.push({ from: f, to: t });
  return out;
}

function EditModal({
  definition,
  nodeOptions,
  onClose,
}: {
  definition: DefinitionRow;
  nodeOptions: { value: string; label: string }[];
  onClose: () => void;
}) {
  const router = useRouter();
  const isNode = definition.kind === 'node';
  const config = (definition.config ?? {}) as {
    fields?: FieldDef[];
    allowedParents?: string[];
    from?: string[];
    to?: string[];
    pairs?: EdgePair[];
    tabs?: TabSpec[];
    sidebar?: boolean;
  };
  const [label, setLabel] = useState(definition.label);
  const [parents, setParents] = useState<string[]>(config.allowedParents ?? []);
  // Prefer explicit pairs; fall back to the legacy from×to cross-product so the
  // editor still works if the edge-pairs migration hasn't run yet.
  const [pairs, setPairs] = useState<EdgePair[]>(config.pairs ?? crossProduct(config.from ?? [], config.to ?? []));
  const [fields, setFields] = useState<Draft[]>((config.fields ?? []).map(toDraft));
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const firstType = nodeOptions[0]?.value ?? '';
  function patchPair(i: number, p: Partial<EdgePair>) {
    setPairs((ps) => ps.map((x, idx) => (idx === i ? { ...x, ...p } : x)));
  }
  function addPair() {
    setPairs((ps) => [...ps, { from: firstType, to: firstType }]);
  }
  function removePair(i: number) {
    setPairs((ps) => ps.filter((_, idx) => idx !== i));
  }

  function patch(i: number, p: Partial<Draft>) {
    setFields((fs) => fs.map((f, idx) => (idx === i ? { ...f, ...p } : f)));
  }
  function moveField(i: number, dir: -1 | 1) {
    setFields((fs) => {
      const next = [...fs];
      const j = i + dir;
      if (j < 0 || j >= next.length) return fs;
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  }
  function addField() {
    setFields((fs) => [...fs, { key: '', label: '', data_type: 'text', required: false, filterable: false, forYou: false, choices: [], min: '', max: '', labels: [] }]);
  }
  function removeField(i: number) {
    setFields((fs) => fs.filter((_, idx) => idx !== i));
  }

  function save() {
    setError(null);
    if (fields.some((f) => !f.key.trim() || !f.label.trim())) {
      setError('Every field needs a key and a label.');
      return;
    }
    const builtFields = fields.map(toField);
    const newConfig = isNode
      ? { ...config, allowedParents: parents, fields: builtFields } // preserve tabs/sidebar (managed in Views)
      : { pairs, fields: builtFields };
    startTransition(async () => {
      try {
        await saveDefinition({ id: definition.id, label, config: newConfig });
        router.refresh();
        onClose();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Save failed');
      }
    });
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={`Edit ${definition.kind} · ${definition.key}`}
      maxWidth={760}
      footer={
        <>
          <Button variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
          <Button variant="primary" size="sm" onClick={save} disabled={pending}>
            {pending && <span className="spinner" aria-hidden />}Save
          </Button>
        </>
      }
    >
      {error && <div className="alert error mb-5">{error}</div>}

      <div className="flex flex-col gap-4 mb-6" style={{ maxWidth: 420 }}>
        <div>
          <label className="field-label">Label</label>
          <input className="field-input" value={label} onChange={(e) => setLabel(e.target.value)} />
        </div>
        {isNode ? (
          <div>
            <label className="field-label">Allowed parent types</label>
            <TagInput value={parents} onChange={setParents} placeholder="type key + Enter" />
          </div>
        ) : (
          <div>
            <label className="field-label">Allowed relationships (from → to)</label>
            <div className="flex flex-col gap-2">
              {pairs.map((p, i) => (
                <div key={i} className="flex items-center gap-2">
                  <Select mono value={p.from} onChange={(v) => patchPair(i, { from: v })} options={nodeOptions} ariaLabel="From type" />
                  <span style={{ color: 'var(--muted)' }} aria-hidden>→</span>
                  <Select mono value={p.to} onChange={(v) => patchPair(i, { to: v })} options={nodeOptions} ariaLabel="To type" />
                  <button type="button" className="muted-link" aria-label="Remove relationship" title="Remove relationship" onClick={() => removePair(i)}>
                    ✕
                  </button>
                </div>
              ))}
              {pairs.length === 0 && (
                <p className="text-[12px]" style={{ color: 'var(--muted)' }}>
                  No relationships yet — this edge can’t connect anything.
                </p>
              )}
            </div>
            <button type="button" className="btn btn-ghost btn-sm mt-2" onClick={addPair}>
              + Add relationship
            </button>
          </div>
        )}
      </div>

      <p className="field-label">Fields</p>
      <div className="flex flex-col gap-3">
        {fields.map((f, i) => (
          <div key={i} style={{ border: '1px solid var(--line)', padding: 12 }}>
            <div className="flex flex-wrap items-end gap-3">
              <div style={{ width: 130 }}>
                <label className="field-label">Key</label>
                <input className="field-input" value={f.key} onChange={(e) => patch(i, { key: e.target.value })} />
              </div>
              <div style={{ width: 150 }}>
                <label className="field-label">Label</label>
                <input className="field-input" value={f.label} onChange={(e) => patch(i, { label: e.target.value })} />
              </div>
              <div>
                <label className="field-label">Type</label>
                <Select
                  mono
                  value={f.data_type}
                  onChange={(v) => patch(i, { data_type: v as FieldDef['data_type'] })}
                  options={DATA_TYPES.map((t) => ({ value: t, label: DATA_TYPE_LABELS[t] }))}
                />
              </div>
              <label className="check">
                <input type="checkbox" checked={f.required} onChange={(e) => patch(i, { required: e.target.checked })} /> req
              </label>
              <label className="check">
                <input type="checkbox" checked={f.filterable} onChange={(e) => patch(i, { filterable: e.target.checked })} /> filter
              </label>
              {isUserType(f.data_type) && (
                <label className="check" title="Surface items where this person is you in the For You tab">
                  <input type="checkbox" checked={f.forYou} onChange={(e) => patch(i, { forYou: e.target.checked })} /> for you
                </label>
              )}
              <span style={{ flex: 1 }} />
              <div className="flex items-center gap-3">
                <button type="button" className="muted-link" aria-label="Move up" title="Up" onClick={() => moveField(i, -1)}>↑</button>
                <button type="button" className="muted-link" aria-label="Move down" title="Down" onClick={() => moveField(i, 1)}>↓</button>
                <button type="button" className="muted-link" aria-label="Remove field" title="Remove" onClick={() => removeField(i)}>✕</button>
              </div>
            </div>

            {f.data_type === 'enum' && (
              <div className="mt-3">
                <label className="field-label">Choices (key · label · colour, drag to reorder)</label>
                <ChoicesEditor value={f.choices} onChange={(v) => patch(i, { choices: v })} />
              </div>
            )}
            {f.data_type === 'number' && (
              <div className="mt-3 flex flex-wrap gap-3">
                <div style={{ width: 90 }}>
                  <label className="field-label">Min</label>
                  <input className="field-input" value={f.min} onChange={(e) => patch(i, { min: e.target.value })} />
                </div>
                <div style={{ width: 90 }}>
                  <label className="field-label">Max</label>
                  <input className="field-input" value={f.max} onChange={(e) => patch(i, { max: e.target.value })} />
                </div>
                <div style={{ flex: 1, minWidth: 220 }}>
                  <label className="field-label">Word labels (min→max order)</label>
                  <TagInput value={f.labels} onChange={(v) => patch(i, { labels: v })} mono={false} placeholder="Very low, Low, … + Enter" />
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      <button type="button" className="btn btn-ghost btn-sm mt-3" onClick={addField}>
        + Add field
      </button>
    </Modal>
  );
}

function CreateModal({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [kind, setKind] = useState<'node' | 'edge'>('node');
  const [key, setKey] = useState('');
  const [label, setLabel] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function create() {
    setError(null);
    if (!key.trim() || !label.trim()) {
      setError('Key and label are required.');
      return;
    }
    const config = kind === 'node' ? { allowedParents: [], fields: [] } : { pairs: [], fields: [] };
    startTransition(async () => {
      try {
        await createDefinition({ kind, key: key.trim(), label: label.trim(), config });
        router.refresh();
        onClose();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Create failed');
      }
    });
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="New type"
      maxWidth={440}
      footer={
        <>
          <Button variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
          <Button variant="primary" size="sm" onClick={create} disabled={pending}>
            {pending && <span className="spinner" aria-hidden />}Create
          </Button>
        </>
      }
    >
      {error && <div className="alert error mb-5">{error}</div>}
      <div className="flex flex-col gap-4">
        <div>
          <label className="field-label">Kind</label>
          <Select
            mono
            value={kind}
            onChange={(v) => setKind(v as 'node' | 'edge')}
            options={[{ value: 'node', label: 'Node' }, { value: 'edge', label: 'Edge' }]}
          />
        </div>
        <div>
          <label className="field-label">Key (lowercase, stable)</label>
          <input className="field-input" value={key} onChange={(e) => setKey(e.target.value)} placeholder="e.g. objective" />
        </div>
        <div>
          <label className="field-label">Label</label>
          <input className="field-input" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Objective" />
        </div>
        <p className="text-[12px]" style={{ color: 'var(--muted)' }}>
          After creating, click Edit to add fields.
        </p>
      </div>
    </Modal>
  );
}

/**
 * Display configuration for a node type, kept separate from the data-shape Edit
 * modal: whether it appears in the nav sidebar, and its detail-screen tabs.
 * Persists `sidebar` + `tabs` onto the definition's config, preserving the rest.
 */
function ViewsModal({
  definition,
  defs,
  onClose,
}: {
  definition: DefinitionRow;
  defs: Record<string, DefinitionRow>;
  onClose: () => void;
}) {
  const router = useRouter();
  const config = (definition.config ?? {}) as {
    fields?: FieldDef[];
    allowedParents?: string[];
    tabs?: TabSpec[];
    sidebar?: boolean;
    icon?: string;
  };
  const [sidebar, setSidebar] = useState<boolean>(!!config.sidebar);
  const [icon, setIcon] = useState<string>(config.icon ?? '');
  const [tabs, setTabs] = useState<TabSpec[]>(config.tabs ?? []);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function save() {
    setError(null);
    const newConfig = { ...config, sidebar, icon: icon || undefined, tabs };
    startTransition(async () => {
      try {
        await saveDefinition({ id: definition.id, label: definition.label, config: newConfig });
        router.refresh();
        onClose();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Save failed');
      }
    });
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={`Views · ${definition.key}`}
      maxWidth={760}
      footer={
        <>
          <Button variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
          <Button variant="primary" size="sm" onClick={save} disabled={pending}>
            {pending && <span className="spinner" aria-hidden />}Save
          </Button>
        </>
      }
    >
      {error && <div className="alert error mb-5">{error}</div>}

      <div className="flex items-center gap-3 mb-4">
        <span className="zone-label">Sidebar</span>
        <span className="flex-1 divider" aria-hidden />
      </div>
      <div className="flex flex-col gap-5 mb-9">
        <div>
          <label className="check">
            <input type="checkbox" checked={sidebar} onChange={(e) => setSidebar(e.target.checked)} />
            Show in sidebar
          </label>
          <p className="text-[12px] mt-1" style={{ color: 'var(--muted)' }}>
            Adds a register link for this type to the nav.
          </p>
        </div>
        <div>
          <label className="field-label">Icon</label>
          <div className="seg">
            <button
              type="button"
              className={icon === '' ? 'on' : undefined}
              aria-label="Default icon"
              title="Default"
              onClick={() => setIcon('')}
            >
              <NodeTypeIcon name="" className="h-4 w-4" aria-hidden />
            </button>
            {NODE_ICON_NAMES.map((n) => (
              <button
                key={n}
                type="button"
                className={icon === n ? 'on' : undefined}
                aria-label={n}
                title={n}
                onClick={() => setIcon(n)}
              >
                <NodeTypeIcon name={n} className="h-4 w-4" aria-hidden />
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3 mb-4">
        <span className="zone-label">Page tabs</span>
        <span className="flex-1 divider" aria-hidden />
      </div>
      <TabsEditor def={definition} defs={defs} value={tabs} onChange={setTabs} />
    </Modal>
  );
}
