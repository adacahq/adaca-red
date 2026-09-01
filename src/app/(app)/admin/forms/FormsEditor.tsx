'use client';

import { useMemo, useState, useTransition, type CSSProperties } from 'react';
import { useRouter } from 'next/navigation';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
import Select from '@/components/ui/Select';
import DataTable, { type Column } from '@/components/ui/DataTable';
import EmptyState from '@/components/ui/EmptyState';
import { useConfirm } from '@/components/ui/Confirm';
import type { DefinitionRow, FieldDef, FormConfig, Json, LandingBlock, UploadKind } from '@/lib/supabase/types';
import { missingRequiredFields } from '@/lib/forms/config';
import { createDefinition, deleteDefinition, saveDefinition } from '@/lib/definitions/actions';
import AdminNav from '../AdminNav';

const REVALIDATE = '/admin/forms';
const UPLOAD_KINDS: UploadKind[] = ['pdf', 'docx', 'pptx', 'xlsx'];
const BLOCK_TYPES: LandingBlock['type'][] = ['prose', 'verdictLegend', 'steps', 'stats'];
const VERDICT_KEYS: ('green' | 'amber' | 'red')[] = ['green', 'amber', 'red'];

function defaultBlock(type: LandingBlock['type']): LandingBlock {
  switch (type) {
    case 'verdictLegend':
      return { type, items: [] };
    case 'steps':
      return { type, items: [] };
    case 'stats':
      return { type, items: [] };
    case 'prose':
    default:
      return { type: 'prose', markdown: '' };
  }
}

const EMPTY: FormConfig = {
  targetType: '',
  workflow: undefined,
  enabled: false,
  fields: [],
  presets: {},
  carryOver: [],
  uploads: { enabled: false, accept: ['pdf', 'docx'], maxFiles: 8, minFiles: 1 },
  copy: { title: '' },
};

export default function FormsEditor({
  forms,
  nodeTypes,
  workflows,
}: {
  forms: DefinitionRow[];
  nodeTypes: DefinitionRow[];
  workflows: DefinitionRow[];
}) {
  const [editing, setEditing] = useState<DefinitionRow | null>(null);
  const [creating, setCreating] = useState(false);
  const router = useRouter();
  const confirm = useConfirm();
  const [, startTransition] = useTransition();

  async function remove(def: DefinitionRow) {
    const ok = await confirm({
      title: 'Delete form',
      body: `Delete “${def.label}”? The public URL /d/${def.key} stops working immediately. Existing submissions are unaffected.`,
      confirmLabel: 'Delete',
      danger: true,
    });
    if (!ok) return;
    startTransition(async () => {
      await deleteDefinition(def.id, REVALIDATE);
      router.refresh();
    });
  }

  const cols: Column<DefinitionRow>[] = [
    {
      key: 'label',
      header: 'Form',
      cell: (def) => (
        <div>
          <div style={{ color: 'var(--fg)', fontWeight: 500 }}>{def.label}</div>
          <a className="mono muted-link" style={{ fontSize: 11 }} href={`/d/${def.key}`} target="_blank" rel="noreferrer">
            /d/{def.key}
          </a>
        </div>
      ),
      sortValue: (def) => def.label.toLowerCase(),
    },
    {
      key: 'status',
      header: 'Status',
      mono: true,
      cell: (def) => {
        const config = (def.config ?? {}) as unknown as FormConfig;
        return <span style={{ color: config.enabled ? 'var(--ok)' : 'var(--muted)' }}>{config.enabled ? 'Live' : 'Off'}</span>;
      },
      sortValue: (def) => (((def.config ?? {}) as unknown as FormConfig).enabled ? 1 : 0),
    },
    {
      key: 'target',
      header: 'Targets',
      mono: true,
      cellStyle: { color: 'var(--muted)' },
      cell: (def) => {
        const config = (def.config ?? {}) as unknown as FormConfig;
        return `→ ${config.targetType || '?'}${config.workflow ? ` · ${config.workflow}` : ''}`;
      },
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      cell: (def) => (
        <div className="flex items-center gap-4 justify-end">
          <button type="button" className="muted-link" onClick={() => setEditing(def)}>Edit</button>
          <button type="button" className="muted-link" onClick={() => remove(def)}>Delete</button>
        </div>
      ),
    },
  ];

  return (
    <div>
      <p className="eyebrow rv">Admin</p>
      <div className="flex items-end justify-between gap-6 flex-wrap">
        <h1 className="view-title rv" style={{ '--i': 1 } as CSSProperties}>Forms</h1>
        <span className="rv" style={{ '--i': 2 } as CSSProperties}>
          <Button variant="primary" size="sm" onClick={() => setCreating(true)}>New form</Button>
        </span>
      </div>
      <p className="lede rv" style={{ '--i': 2 } as CSSProperties}>
        Public, no-login intake forms. Each form targets a node type: submissions create
        nodes in that register, with required fields either exposed to the submitter or
        preset (tokens like {'{{submission_number}}'} supported). Live at{' '}
        <span className="mono">/d/&lt;key&gt;</span> — turning a form off or deleting it
        stops the public URL immediately, though submissions already collected are
        unaffected.
      </p>

      <AdminNav />

      <div className="mt-10 rv" style={{ '--i': 3 } as CSSProperties}>
        {forms.length === 0 ? (
          <EmptyState eyebrow="Forms" title="No forms yet" description="Create one with New form, above." />
        ) : (
          <DataTable columns={cols} rows={forms} getRowKey={(d) => d.id} empty="No forms yet." />
        )}
      </div>

      {(editing || creating) && (
        <FormModal
          definition={editing}
          nodeTypes={nodeTypes}
          workflows={workflows}
          onClose={() => {
            setEditing(null);
            setCreating(false);
          }}
        />
      )}
    </div>
  );
}

function FormModal({
  definition,
  nodeTypes,
  workflows,
  onClose,
}: {
  definition: DefinitionRow | null;
  nodeTypes: DefinitionRow[];
  workflows: DefinitionRow[];
  onClose: () => void;
}) {
  const router = useRouter();
  const initial = definition ? ((definition.config ?? {}) as unknown as FormConfig) : EMPTY;
  const [key, setKey] = useState(definition?.key ?? '');
  const [label, setLabel] = useState(definition?.label ?? '');
  const [config, setConfig] = useState<FormConfig>({ ...EMPTY, ...initial, copy: { ...EMPTY.copy, ...initial.copy } });
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const target = nodeTypes.find((n) => n.key === config.targetType);
  const targetFields: FieldDef[] = useMemo(
    () => (((target?.config ?? {}) as { fields?: FieldDef[] }).fields ?? []).sort((a, b) => (a.position ?? 0) - (b.position ?? 0)),
    [target],
  );
  const missing = target ? missingRequiredFields(config, targetFields) : [];

  function patch(p: Partial<FormConfig>) {
    setConfig((c) => ({ ...c, ...p }));
  }
  function patchCopy(p: Partial<FormConfig['copy']>) {
    setConfig((c) => ({ ...c, copy: { ...c.copy, ...p } }));
  }
  function patchCta(p: Partial<{ label: string; href: string }>) {
    setConfig((c) => {
      const next = { ...(c.copy.cta ?? { label: '', href: '' }), ...p };
      const copy = { ...c.copy };
      if (!next.label.trim() && !next.href.trim()) delete copy.cta;
      else copy.cta = next;
      return { ...c, copy };
    });
  }
  function patchBlock(i: number, block: LandingBlock) {
    setConfig((c) => ({ ...c, copy: { ...c.copy, blocks: (c.copy.blocks ?? []).map((b, idx) => (idx === i ? block : b)) } }));
  }
  function moveBlock(i: number, dir: -1 | 1) {
    setConfig((c) => {
      const blocks = c.copy.blocks ?? [];
      const j = i + dir;
      if (j < 0 || j >= blocks.length) return c;
      const next = [...blocks];
      [next[i], next[j]] = [next[j], next[i]];
      return { ...c, copy: { ...c.copy, blocks: next } };
    });
  }
  function removeBlock(i: number) {
    setConfig((c) => ({ ...c, copy: { ...c.copy, blocks: (c.copy.blocks ?? []).filter((_, idx) => idx !== i) } }));
  }
  function addBlock(type: LandingBlock['type']) {
    setConfig((c) => ({ ...c, copy: { ...c.copy, blocks: [...(c.copy.blocks ?? []), defaultBlock(type)] } }));
  }
  function toggleIn(list: string[], key: string): string[] {
    return list.includes(key) ? list.filter((k) => k !== key) : [...list, key];
  }

  function save() {
    setError(null);
    if (!label.trim() || (!definition && !key.trim())) {
      setError('Key and label are required.');
      return;
    }
    if (!config.targetType) {
      setError('Pick a target type — submissions have to land somewhere.');
      return;
    }
    if (config.enabled && missing.length > 0) {
      setError(`Can't go live: required fields with no input and no preset: ${missing.join(', ')}.`);
      return;
    }
    startTransition(async () => {
      try {
        const cfg = config as unknown as Json;
        if (definition) {
          await saveDefinition({ id: definition.id, label: label.trim(), config: cfg, revalidate: REVALIDATE });
        } else {
          await createDefinition({ kind: 'form', key: key.trim(), label: label.trim(), config: cfg, revalidate: REVALIDATE });
        }
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
      title={definition ? `Edit form · ${definition.key}` : 'New form'}
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

      <div className="flex flex-col gap-4 mb-6">
        <div className="flex flex-wrap items-end gap-3">
          {!definition && (
            <div style={{ width: 180 }}>
              <label className="field-label">Key (public URL: /d/key)</label>
              <input className="field-input" value={key} onChange={(e) => setKey(e.target.value)} placeholder="diagnostic" />
            </div>
          )}
          <div style={{ flex: 1, minWidth: 220 }}>
            <label className="field-label">Label</label>
            <input className="field-input" value={label} onChange={(e) => setLabel(e.target.value)} />
          </div>
          <label className="check">
            <input type="checkbox" checked={config.enabled} onChange={(e) => patch({ enabled: e.target.checked })} />
            Live
          </label>
        </div>

        <div className="flex flex-wrap gap-3">
          <div style={{ width: 220 }}>
            <label className="field-label">Target type (register)</label>
            <Select
              mono
              fullWidth
              ariaLabel="Target type"
              placeholder="–"
              value={config.targetType}
              onChange={(v) => patch({ targetType: v, fields: [], presets: {}, carryOver: [] })}
              options={nodeTypes.map((n) => ({ value: n.key, label: `${n.label} (${n.key})` }))}
            />
          </div>
          <div style={{ width: 260 }}>
            <label className="field-label">Workflow on submit</label>
            <Select
              mono
              fullWidth
              ariaLabel="Workflow"
              placeholder="None"
              value={config.workflow ?? ''}
              onChange={(v) => patch({ workflow: v || undefined })}
              options={[{ value: '', label: 'None' }, ...workflows.map((w) => ({ value: w.key, label: `${w.label} (${w.key})` }))]}
            />
          </div>
        </div>
      </div>

      {target && (
        <>
          <p className="field-label">Fields — ask the submitter, or preset (tokens: {'{{submission_number}} {{submission_date}} {{form_key}} {{form_label}}'})</p>
          {missing.length > 0 && (
            <p className="mb-2 text-[12px]" style={{ color: 'var(--warn)' }}>
              Required but unset: {missing.join(', ')}
            </p>
          )}
          <div className="mb-6" style={{ borderTop: '1px solid var(--line)' }}>
            {targetFields.map((f) => {
              const exposed = config.fields.includes(f.key);
              const preset = config.presets[f.key];
              return (
                <div key={f.key} className="flex items-center gap-3 py-2" style={{ borderBottom: '1px solid var(--line)' }}>
                  <span className="mono" style={{ fontSize: 11, color: 'var(--muted)', width: 120, flexShrink: 0 }}>{f.key}</span>
                  <label className="check" style={{ flexShrink: 0 }}>
                    <input
                      type="checkbox"
                      checked={exposed}
                      onChange={() => patch({ fields: toggleIn(config.fields, f.key) })}
                    />
                    ask
                  </label>
                  <input
                    className="field-input"
                    style={{ flex: 1 }}
                    placeholder={exposed ? '(asked on the form)' : 'preset value or {{token}}'}
                    disabled={exposed}
                    value={preset ?? ''}
                    onChange={(e) => {
                      const presets = { ...config.presets };
                      if (e.target.value === '') delete presets[f.key];
                      else presets[f.key] = e.target.value;
                      patch({ presets });
                    }}
                  />
                  <label
                    className="check"
                    style={{ flexShrink: 0 }}
                    title="Copy this field onto the assessment (survives submission purge — the lead trail)"
                  >
                    <input
                      type="checkbox"
                      checked={(config.carryOver ?? []).includes(f.key)}
                      onChange={() => patch({ carryOver: toggleIn(config.carryOver ?? [], f.key) })}
                    />
                    carry over
                  </label>
                  {f.required && <span style={{ color: 'var(--accent)', flexShrink: 0 }}>*</span>}
                </div>
              );
            })}
          </div>
        </>
      )}

      <p className="field-label">Uploads</p>
      <div className="mb-6 flex flex-col gap-3">
        <div className="flex flex-wrap items-end gap-4">
          <label className="check">
            <input
              type="checkbox"
              checked={!!config.uploads?.enabled}
              onChange={(e) => patch({ uploads: { ...(config.uploads ?? EMPTY.uploads!), enabled: e.target.checked } })}
            />
            Accept documents
          </label>
          {config.uploads?.enabled && (
            <>
              <div style={{ width: 90 }}>
                <label className="field-label">Min files</label>
                <input
                  type="number"
                  className="field-input"
                  min={0}
                  value={config.uploads.minFiles ?? 0}
                  onChange={(e) => patch({ uploads: { ...config.uploads!, minFiles: Math.max(0, Number(e.target.value) || 0) } })}
                />
              </div>
              <div style={{ width: 90 }}>
                <label className="field-label">Max files</label>
                <input
                  type="number"
                  className="field-input"
                  min={1}
                  value={config.uploads.maxFiles}
                  onChange={(e) => patch({ uploads: { ...config.uploads!, maxFiles: Math.max(1, Number(e.target.value) || 1) } })}
                />
              </div>
              <div style={{ flex: 1, minWidth: 260 }}>
                <label className="field-label">Guidance (what to include)</label>
                <input
                  className="field-input"
                  value={config.uploads.guidance ?? ''}
                  onChange={(e) => patch({ uploads: { ...config.uploads!, guidance: e.target.value || undefined } })}
                />
              </div>
            </>
          )}
        </div>
        {config.uploads?.enabled && (
          <div className="flex flex-wrap items-center gap-4">
            {UPLOAD_KINDS.map((k) => {
              const accept = config.uploads?.accept ?? [];
              return (
                <label key={k} className="check mono" style={{ textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  <input
                    type="checkbox"
                    checked={accept.includes(k)}
                    onChange={() =>
                      patch({
                        uploads: {
                          ...config.uploads!,
                          accept: accept.includes(k) ? accept.filter((x) => x !== k) : [...accept, k],
                        },
                      })
                    }
                  />
                  {k}
                </label>
              );
            })}
          </div>
        )}
      </div>

      <p className="field-label">Copy</p>
      <div className="flex flex-col gap-3">
        <div>
          <label className="field-label">Page title</label>
          <input className="field-input" value={config.copy.title} onChange={(e) => patchCopy({ title: e.target.value })} />
        </div>
        <div>
          <label className="field-label">Intro (markdown)</label>
          <textarea
            className="field-input"
            rows={3}
            value={config.copy.intro ?? ''}
            onChange={(e) => patchCopy({ intro: e.target.value || undefined })}
          />
        </div>
        <div className="flex flex-wrap gap-3">
          <div style={{ width: 220 }}>
            <label className="field-label">Submit button</label>
            <input className="field-input" value={config.copy.submitLabel ?? ''} placeholder="Submit" onChange={(e) => patchCopy({ submitLabel: e.target.value || undefined })} />
          </div>
          <div style={{ flex: 1, minWidth: 260 }}>
            <label className="field-label">Extra privacy note (appended to the generated retention line)</label>
            <input className="field-input" value={config.copy.privacyNote ?? ''} onChange={(e) => patchCopy({ privacyNote: e.target.value || undefined })} />
          </div>
        </div>
        <div className="flex flex-wrap gap-3">
          <div style={{ width: 220 }}>
            <label className="field-label">CTA label</label>
            <input className="field-input" value={config.copy.cta?.label ?? ''} onChange={(e) => patchCta({ label: e.target.value })} />
          </div>
          <div style={{ flex: 1, minWidth: 260 }}>
            <label className="field-label">CTA link</label>
            <input className="field-input mono" value={config.copy.cta?.href ?? ''} onChange={(e) => patchCta({ href: e.target.value })} />
          </div>
        </div>
      </div>

      <p className="field-label mt-6">Landing blocks (rendered between the intro and the form)</p>
      <div className="flex flex-col gap-3">
        {(config.copy.blocks ?? []).map((block, i) => (
          <div key={i} style={{ border: '1px solid var(--line)', padding: 12 }}>
            <div className="flex items-center gap-2 mb-2">
              <span className="mono" style={{ fontSize: 12, color: 'var(--accent)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                {i + 1} · {block.type}
              </span>
              <span style={{ flex: 1 }} />
              <button type="button" className="muted-link" aria-label="Move up" title="Up" onClick={() => moveBlock(i, -1)}>↑</button>
              <button type="button" className="muted-link" aria-label="Move down" title="Down" onClick={() => moveBlock(i, 1)}>↓</button>
              <button type="button" className="muted-link" aria-label="Remove block" title="Remove block" onClick={() => removeBlock(i)}>
                ✕
              </button>
            </div>
            <BlockFields block={block} onChange={(next) => patchBlock(i, next)} />
          </div>
        ))}
        <div className="flex flex-wrap gap-2">
          {BLOCK_TYPES.map((t) => (
            <button key={t} type="button" className="btn btn-ghost btn-sm" onClick={() => addBlock(t)}>
              + {t}
            </button>
          ))}
        </div>
      </div>
    </Modal>
  );
}

function BlockFields({ block, onChange }: { block: LandingBlock; onChange: (b: LandingBlock) => void }) {
  switch (block.type) {
    case 'prose':
      return (
        <textarea
          className="field-input"
          rows={3}
          placeholder="Markdown"
          value={block.markdown}
          onChange={(e) => onChange({ ...block, markdown: e.target.value })}
        />
      );
    case 'verdictLegend':
      return <VerdictLegendFields block={block} onChange={onChange} />;
    case 'steps':
      return <StepsBlockFields block={block} onChange={onChange} />;
    case 'stats':
      return <StatsBlockFields block={block} onChange={onChange} />;
    default:
      return null;
  }
}

function VerdictLegendFields({
  block,
  onChange,
}: {
  block: Extract<LandingBlock, { type: 'verdictLegend' }>;
  onChange: (b: LandingBlock) => void;
}) {
  const items = block.items ?? [];
  function patchItem(key: 'green' | 'amber' | 'red', p: Partial<{ label: string; description: string }>) {
    const next = items.some((it) => it.key === key)
      ? items.map((it) => (it.key === key ? { ...it, ...p } : it))
      : [...items, { key, ...p }];
    onChange({ ...block, items: next });
  }
  return (
    <div className="flex flex-col gap-2">
      {VERDICT_KEYS.map((key) => {
        const item = items.find((it) => it.key === key);
        return (
          <div key={key} className="flex items-center gap-2">
            <span className="mono" style={{ width: 56, fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', flexShrink: 0 }}>{key}</span>
            <input
              className="field-input"
              style={{ width: 140 }}
              placeholder="Label"
              aria-label={`${key} label`}
              value={item?.label ?? ''}
              onChange={(e) => patchItem(key, { label: e.target.value })}
            />
            <input
              className="field-input"
              style={{ flex: 1 }}
              placeholder="Description (blank = derived from the workflow's verdict thresholds)"
              aria-label={`${key} description`}
              value={item?.description ?? ''}
              onChange={(e) => patchItem(key, { description: e.target.value })}
            />
          </div>
        );
      })}
    </div>
  );
}

function StepsBlockFields({
  block,
  onChange,
}: {
  block: Extract<LandingBlock, { type: 'steps' }>;
  onChange: (b: LandingBlock) => void;
}) {
  function patchItem(i: number, p: Partial<{ label: string; description?: string }>) {
    onChange({ ...block, items: block.items.map((it, idx) => (idx === i ? { ...it, ...p } : it)) });
  }
  return (
    <div className="flex flex-col gap-2">
      {block.items.map((item, i) => (
        <div key={i} className="flex items-center gap-2">
          <span className="mono" style={{ width: 22, fontSize: 11, color: 'var(--muted)', flexShrink: 0 }}>{String(i + 1).padStart(2, '0')}</span>
          <input className="field-input" style={{ width: 200 }} placeholder="Label" aria-label="Step label" value={item.label} onChange={(e) => patchItem(i, { label: e.target.value })} />
          <input
            className="field-input"
            style={{ flex: 1 }}
            placeholder="Description (optional)"
            aria-label="Step description"
            value={item.description ?? ''}
            onChange={(e) => patchItem(i, { description: e.target.value || undefined })}
          />
          <button type="button" className="muted-link" aria-label="Remove step" title="Remove step" onClick={() => onChange({ ...block, items: block.items.filter((_, idx) => idx !== i) })}>
            ✕
          </button>
        </div>
      ))}
      <button
        type="button"
        className="btn btn-ghost btn-sm self-start"
        onClick={() => onChange({ ...block, items: [...block.items, { label: '' }] })}
      >
        + Add item
      </button>
    </div>
  );
}

function StatsBlockFields({
  block,
  onChange,
}: {
  block: Extract<LandingBlock, { type: 'stats' }>;
  onChange: (b: LandingBlock) => void;
}) {
  function patchItem(i: number, p: Partial<{ value: string; label: string }>) {
    onChange({ ...block, items: block.items.map((it, idx) => (idx === i ? { ...it, ...p } : it)) });
  }
  return (
    <div className="flex flex-col gap-2">
      {block.items.map((item, i) => (
        <div key={i} className="flex items-center gap-2">
          <input className="field-input" style={{ width: 100 }} placeholder="Value" aria-label="Stat value" value={item.value} onChange={(e) => patchItem(i, { value: e.target.value })} />
          <input className="field-input" style={{ flex: 1 }} placeholder="Label" aria-label="Stat label" value={item.label} onChange={(e) => patchItem(i, { label: e.target.value })} />
          <button type="button" className="muted-link" aria-label="Remove stat" title="Remove stat" onClick={() => onChange({ ...block, items: block.items.filter((_, idx) => idx !== i) })}>
            ✕
          </button>
        </div>
      ))}
      <button
        type="button"
        className="btn btn-ghost btn-sm self-start"
        onClick={() => onChange({ ...block, items: [...block.items, { value: '', label: '' }] })}
      >
        + Add stat
      </button>
    </div>
  );
}
