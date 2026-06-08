'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  PlusIcon,
  TrashIcon,
  PencilSquareIcon,
  ChevronUpIcon,
  ChevronDownIcon,
} from '@heroicons/react/20/solid';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
import Select from '@/components/ui/Select';
import TagInput from '@/components/ui/TagInput';
import ChoicesEditor from '@/components/ui/ChoicesEditor';
import { useConfirm } from '@/components/ui/Confirm';
import { getChoices } from '@/lib/definitions/choices';
import type { ChoiceOption, DefinitionRow, FieldDef } from '@/lib/supabase/types';
import { saveDefinition, createDefinition, deleteDefinition } from '@/lib/definitions/actions';

const DATA_TYPES = ['text', 'number', 'enum', 'date', 'boolean', 'richtext', 'user'] as const;

interface Draft {
  key: string;
  label: string;
  data_type: FieldDef['data_type'];
  required: boolean;
  filterable: boolean;
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
    position: i,
    options: Object.keys(options).length ? options : undefined,
  };
}

export default function DefinitionsEditor({ definitions }: { definitions: DefinitionRow[] }) {
  const [editing, setEditing] = useState<DefinitionRow | null>(null);
  const [creating, setCreating] = useState(false);
  const router = useRouter();
  const confirm = useConfirm();
  const [, startTransition] = useTransition();

  const nodes = definitions.filter((d) => d.kind === 'node');
  const edges = definitions.filter((d) => d.kind === 'edge');

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
      <div className="mb-6 flex justify-end">
        <Button variant="primary" size="sm" onClick={() => setCreating(true)}>
          <PlusIcon className="h-4 w-4" /> New type
        </Button>
      </div>

      <TypeSection title="Node types" items={nodes} onEdit={setEditing} onRemove={remove} />
      <TypeSection title="Edge types" items={edges} onEdit={setEditing} onRemove={remove} />

      {editing && <EditModal definition={editing} onClose={() => setEditing(null)} />}
      {creating && <CreateModal onClose={() => setCreating(false)} />}
    </div>
  );
}

function TypeSection({
  title,
  items,
  onEdit,
  onRemove,
}: {
  title: string;
  items: DefinitionRow[];
  onEdit: (d: DefinitionRow) => void;
  onRemove: (d: DefinitionRow) => void;
}) {
  return (
    <section className="mb-8">
      <p className="field-label">{title}</p>
      <div style={{ borderTop: '1px solid var(--line)' }}>
        {items.map((def) => {
          const fieldCount = (((def.config ?? {}) as { fields?: unknown[] }).fields ?? []).length;
          return (
            <div key={def.id} className="flex items-center gap-3 py-3" style={{ borderBottom: '1px solid var(--line)' }}>
              <span style={{ fontSize: 15, color: 'var(--ink)', fontWeight: 500 }}>{def.label}</span>
              <span className="mono" style={{ fontSize: 11, color: 'var(--muted-2)' }}>{def.key}</span>
              <span style={{ flex: 1 }} />
              <span className="mono" style={{ fontSize: 11, color: 'var(--muted-2)' }}>{fieldCount} fields</span>
              <button type="button" className="muted-link" title="Edit" onClick={() => onEdit(def)}>
                <PencilSquareIcon className="h-4 w-4" aria-hidden />
              </button>
              <button type="button" className="muted-link" title="Delete" onClick={() => onRemove(def)}>
                <TrashIcon className="h-4 w-4" aria-hidden />
              </button>
            </div>
          );
        })}
        {items.length === 0 && <p className="py-3 text-[13px]" style={{ color: 'var(--muted-2)' }}>None.</p>}
      </div>
    </section>
  );
}

function EditModal({ definition, onClose }: { definition: DefinitionRow; onClose: () => void }) {
  const router = useRouter();
  const isNode = definition.kind === 'node';
  const config = (definition.config ?? {}) as {
    fields?: FieldDef[];
    allowedParents?: string[];
    from?: string[];
    to?: string[];
  };
  const [label, setLabel] = useState(definition.label);
  const [parents, setParents] = useState<string[]>(config.allowedParents ?? []);
  const [from, setFrom] = useState<string[]>(config.from ?? []);
  const [to, setTo] = useState<string[]>(config.to ?? []);
  const [fields, setFields] = useState<Draft[]>((config.fields ?? []).map(toDraft));
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

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
    setFields((fs) => [...fs, { key: '', label: '', data_type: 'text', required: false, filterable: false, choices: [], min: '', max: '', labels: [] }]);
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
      ? { allowedParents: parents, fields: builtFields }
      : { from: from, to: to, fields: builtFields };
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
      {error && (
        <div className="mb-5 px-4 py-3 text-[13px]" style={{ background: 'var(--red-tint)', color: 'var(--red-ink)', border: '1px solid color-mix(in srgb, var(--crit) 25%, transparent)' }}>
          {error}
        </div>
      )}

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
          <div className="flex gap-3">
            <div style={{ flex: 1 }}>
              <label className="field-label">From types</label>
              <TagInput value={from} onChange={setFrom} placeholder="initiative" />
            </div>
            <div style={{ flex: 1 }}>
              <label className="field-label">To types</label>
              <TagInput value={to} onChange={setTo} placeholder="risk" />
            </div>
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
                  options={DATA_TYPES.map((t) => ({ value: t, label: t }))}
                />
              </div>
              <label className="flex items-center gap-1.5 text-[12px]" style={{ color: 'var(--muted)' }}>
                <input type="checkbox" checked={f.required} onChange={(e) => patch(i, { required: e.target.checked })} /> req
              </label>
              <label className="flex items-center gap-1.5 text-[12px]" style={{ color: 'var(--muted)' }}>
                <input type="checkbox" checked={f.filterable} onChange={(e) => patch(i, { filterable: e.target.checked })} /> filter
              </label>
              <span style={{ flex: 1 }} />
              <div className="flex items-center gap-1">
                <button type="button" className="muted-link" title="Up" onClick={() => moveField(i, -1)}><ChevronUpIcon className="h-4 w-4" /></button>
                <button type="button" className="muted-link" title="Down" onClick={() => moveField(i, 1)}><ChevronDownIcon className="h-4 w-4" /></button>
                <button type="button" className="muted-link" title="Remove" onClick={() => removeField(i)}><TrashIcon className="h-4 w-4" /></button>
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
        <PlusIcon className="h-4 w-4" /> Add field
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
    const config = kind === 'node' ? { allowedParents: [], fields: [] } : { from: [], to: [], fields: [] };
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
      {error && (
        <div className="mb-5 px-4 py-3 text-[13px]" style={{ background: 'var(--red-tint)', color: 'var(--red-ink)', border: '1px solid color-mix(in srgb, var(--crit) 25%, transparent)' }}>
          {error}
        </div>
      )}
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
        <p className="text-[12px]" style={{ color: 'var(--muted-2)' }}>
          After creating, click Edit to add fields.
        </p>
      </div>
    </Modal>
  );
}
