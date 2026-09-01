'use client';

import { useState, useTransition, type CSSProperties } from 'react';
import { useRouter } from 'next/navigation';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
import Select from '@/components/ui/Select';
import DataTable, { type Column } from '@/components/ui/DataTable';
import EmptyState from '@/components/ui/EmptyState';
import { useConfirm } from '@/components/ui/Confirm';
import type {
  DefinitionRow,
  Json,
  ReportSection,
  WorkflowConfig,
  WorkflowStep,
} from '@/lib/supabase/types';
import { STEP_LABELS } from '@/lib/workflows/types';
import { createDefinition, deleteDefinition, saveDefinition } from '@/lib/definitions/actions';
import FailedRuns, { type FailedRun } from './FailedRuns';
import AdminNav from '../AdminNav';

const REVALIDATE = '/admin/workflows';

const STEP_TYPES: WorkflowStep['type'][] = ['extract', 'assess', 'coherence', 'verdict', 'report', 'notify'];

function defaultStep(type: WorkflowStep['type'], rubricKey: string): WorkflowStep {
  switch (type) {
    case 'assess':
      return { type, config: { rubric: rubricKey } };
    case 'verdict':
      return { type, config: { thresholds: { green: 0.8, amber: 0.5 } } };
    case 'report':
      return { type, config: { sections: [] } };
    case 'notify':
      return { type, config: { emailField: 'contact_email', subject: 'Your report — {{verdict_label}}', ctas: [] } };
    case 'coherence':
      return { type, config: {} };
    case 'extract':
    default:
      return { type: 'extract' };
  }
}

export default function WorkflowsEditor({
  workflows,
  rubrics,
  nodeTypes,
  failed,
}: {
  workflows: DefinitionRow[];
  rubrics: DefinitionRow[];
  nodeTypes: DefinitionRow[];
  failed: FailedRun[];
}) {
  const [editing, setEditing] = useState<DefinitionRow | null>(null);
  const [creating, setCreating] = useState(false);
  const router = useRouter();
  const confirm = useConfirm();
  const [, startTransition] = useTransition();

  async function remove(def: DefinitionRow) {
    const ok = await confirm({
      title: 'Delete workflow',
      body: `Delete “${def.label}”? Forms pointing at it will accept submissions that never process.`,
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
      header: 'Workflow',
      cell: (def) => (
        <div>
          <div style={{ color: 'var(--fg)', fontWeight: 500 }}>{def.label}</div>
          <div className="mono" style={{ fontSize: 11, color: 'var(--muted)' }}>{def.key}</div>
        </div>
      ),
      sortValue: (def) => def.label.toLowerCase(),
    },
    {
      key: 'steps',
      header: 'Pipeline',
      mono: true,
      cellStyle: { color: 'var(--muted)' },
      cell: (def) => {
        const config = (def.config ?? {}) as unknown as WorkflowConfig;
        return `${(config.steps ?? []).map((s) => s.type).join(' → ')} → ${config.resultType || '?'}`;
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
        <h1 className="view-title rv" style={{ '--i': 1 } as CSSProperties}>Workflows</h1>
        <span className="rv" style={{ '--i': 2 } as CSSProperties}>
          <Button variant="primary" size="sm" onClick={() => setCreating(true)}>New workflow</Button>
        </span>
      </div>
      <p className="lede rv" style={{ '--i': 2 } as CSSProperties}>
        Typed-step pipelines that process form submissions: extract → assess (against a
        rubric) → coherence → verdict → report → notify. Prompts, models and thresholds
        are config — tune them here, no deploy, and the change applies to the very next
        submission.
      </p>

      <AdminNav />

      <div className="mt-10 rv" style={{ '--i': 3 } as CSSProperties}>
        <FailedRuns failed={failed} />

        {workflows.length === 0 ? (
          <EmptyState eyebrow="Workflows" title="No workflows yet" description="Create one with New workflow, above." />
        ) : (
          <DataTable columns={cols} rows={workflows} getRowKey={(d) => d.id} empty="No workflows yet." />
        )}
      </div>

      {(editing || creating) && (
        <WorkflowModal
          definition={editing}
          rubrics={rubrics}
          nodeTypes={nodeTypes}
          onClose={() => {
            setEditing(null);
            setCreating(false);
          }}
        />
      )}
    </div>
  );
}

function WorkflowModal({
  definition,
  rubrics,
  nodeTypes,
  onClose,
}: {
  definition: DefinitionRow | null;
  rubrics: DefinitionRow[];
  nodeTypes: DefinitionRow[];
  onClose: () => void;
}) {
  const router = useRouter();
  const initial = definition ? ((definition.config ?? {}) as unknown as WorkflowConfig) : null;
  const [key, setKey] = useState(definition?.key ?? '');
  const [label, setLabel] = useState(definition?.label ?? '');
  const [resultType, setResultType] = useState(initial?.resultType ?? '');
  const [model, setModel] = useState(initial?.model ?? 'claude-opus-4-8');
  const [steps, setSteps] = useState<WorkflowStep[]>(initial?.steps ?? []);
  const [showStages, setShowStages] = useState(initial?.status?.showStages ?? false);
  const [showDetail, setShowDetail] = useState(initial?.status?.showDetail ?? false);
  const [expectedMin, setExpectedMin] = useState<number | undefined>(initial?.status?.expectedMinutes?.[0]);
  const [expectedMax, setExpectedMax] = useState<number | undefined>(initial?.status?.expectedMinutes?.[1]);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const firstRubric = rubrics[0]?.key ?? '';

  function patchStep(i: number, step: WorkflowStep) {
    setSteps((ss) => ss.map((s, idx) => (idx === i ? step : s)));
  }
  function moveStep(i: number, dir: -1 | 1) {
    setSteps((ss) => {
      const j = i + dir;
      if (j < 0 || j >= ss.length) return ss;
      const next = [...ss];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  }

  function save() {
    setError(null);
    if (!label.trim() || (!definition && !key.trim())) {
      setError('Key and label are required.');
      return;
    }
    if (!resultType) {
      setError('Pick a result type — the pipeline has to produce something.');
      return;
    }
    if (steps.some((s) => s.type === 'verdict' || s.type === 'report') && !steps.some((s) => s.type === 'assess')) {
      setError('verdict/report steps need an assess step before them.');
      return;
    }
    // Report output is merged by section key (the owned-key map — see
    // ReportRunOutput in workflows/types.ts): an empty or duplicate key
    // silently loses one section's content and duplicates a React key on the
    // report page, so this has to be caught here, before save.
    for (const s of steps) {
      if (s.type !== 'report') continue;
      const sectionKeys = s.config.sections.map((sec) => sec.key.trim());
      if (sectionKeys.some((k) => !k)) {
        setError('Every report section needs a key.');
        return;
      }
      const seenSectionKeys = new Set<string>();
      for (const k of sectionKeys) {
        if (seenSectionKeys.has(k)) {
          setError(`Duplicate report section key: ${k}. Section output is merged by key — a duplicate silently loses one section's content.`);
          return;
        }
        seenSectionKeys.add(k);
      }
    }
    const status: WorkflowConfig['status'] = {
      ...(showStages ? { showStages: true } : {}),
      ...(showDetail ? { showDetail: true } : {}),
      // [n, m] only when both bounds are set — a lone bound isn't renderable copy.
      ...(expectedMin != null && expectedMax != null ? { expectedMinutes: [expectedMin, expectedMax] as [number, number] } : {}),
    };
    const config = {
      resultType,
      model: model.trim() || undefined,
      steps,
      status: Object.keys(status).length > 0 ? status : undefined,
    } as unknown as Json;
    startTransition(async () => {
      try {
        if (definition) {
          await saveDefinition({ id: definition.id, label: label.trim(), config, revalidate: REVALIDATE });
        } else {
          await createDefinition({ kind: 'workflow', key: key.trim(), label: label.trim(), config, revalidate: REVALIDATE });
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
      title={definition ? `Edit workflow · ${definition.key}` : 'New workflow'}
      maxWidth={860}
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

      <div className="flex flex-wrap gap-3 mb-6">
        {!definition && (
          <div style={{ width: 200 }}>
            <label className="field-label">Key</label>
            <input className="field-input" value={key} onChange={(e) => setKey(e.target.value)} placeholder="baseline_diagnostic" />
          </div>
        )}
        <div style={{ flex: 1, minWidth: 220 }}>
          <label className="field-label">Label</label>
          <input className="field-input" value={label} onChange={(e) => setLabel(e.target.value)} />
        </div>
        <div style={{ width: 200 }}>
          <label className="field-label">Result type</label>
          <Select
            mono
            fullWidth
            ariaLabel="Result type"
            placeholder="–"
            value={resultType}
            onChange={setResultType}
            options={nodeTypes.map((n) => ({ value: n.key, label: `${n.label} (${n.key})` }))}
          />
        </div>
        <div style={{ width: 200 }}>
          <label className="field-label">Model</label>
          <input className="field-input mono" value={model} onChange={(e) => setModel(e.target.value)} />
        </div>
      </div>

      <p className="field-label">Steps (in order)</p>
      <div className="flex flex-col gap-3">
        {steps.map((s, i) => (
          <div key={i} style={{ border: '1px solid var(--line)', padding: 12 }}>
            <div className="flex items-center gap-2 mb-2">
              <span className="mono" style={{ fontSize: 12, color: 'var(--accent)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                {i + 1} · {s.type}
              </span>
              <input
                className="field-input mono"
                style={{ width: 220 }}
                placeholder={STEP_LABELS[s.type]}
                aria-label="Status-page label override"
                value={s.label ?? ''}
                onChange={(e) => patchStep(i, { ...s, label: e.target.value || undefined })}
              />
              <span style={{ flex: 1 }} />
              <button type="button" className="muted-link" aria-label="Move up" title="Up" onClick={() => moveStep(i, -1)}>↑</button>
              <button type="button" className="muted-link" aria-label="Move down" title="Down" onClick={() => moveStep(i, 1)}>↓</button>
              <button type="button" className="muted-link" aria-label="Remove step" title="Remove step" onClick={() => setSteps((ss) => ss.filter((_, idx) => idx !== i))}>
                ✕
              </button>
            </div>
            <StepConfig step={s} rubrics={rubrics} onChange={(next) => patchStep(i, next)} />
          </div>
        ))}
        <div className="flex flex-wrap gap-2">
          {STEP_TYPES.map((t) => (
            <button
              key={t}
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => setSteps((ss) => [...ss, defaultStep(t, firstRubric)])}
            >
              + {t}
            </button>
          ))}
        </div>
      </div>

      <p className="field-label mt-6">Status page</p>
      <div className="flex flex-wrap items-end gap-4">
        <label className="check">
          <input type="checkbox" checked={showStages} onChange={(e) => setShowStages(e.target.checked)} />
          Show stage list
        </label>
        <label className="check">
          <input type="checkbox" checked={showDetail} onChange={(e) => setShowDetail(e.target.checked)} />
          Show live sub-unit detail
        </label>
        <div style={{ width: 90 }}>
          <label className="field-label">Min minutes</label>
          <input
            className="field-input"
            value={expectedMin ?? ''}
            placeholder="–"
            aria-label="Expected minutes (low)"
            onChange={(e) => setExpectedMin(e.target.value === '' ? undefined : Number(e.target.value) || 0)}
          />
        </div>
        <div style={{ width: 90 }}>
          <label className="field-label">Max minutes</label>
          <input
            className="field-input"
            value={expectedMax ?? ''}
            placeholder="–"
            aria-label="Expected minutes (high)"
            onChange={(e) => setExpectedMax(e.target.value === '' ? undefined : Number(e.target.value) || 0)}
          />
        </div>
      </div>
      <p className="mt-2 text-[12px]" style={{ color: 'var(--muted)' }}>
        Both minutes are needed to show the estimate; blank keeps &ldquo;This usually takes a few minutes.&rdquo;
      </p>
    </Modal>
  );
}

function StepConfig({
  step,
  rubrics,
  onChange,
}: {
  step: WorkflowStep;
  rubrics: DefinitionRow[];
  onChange: (s: WorkflowStep) => void;
}) {
  switch (step.type) {
    case 'extract':
      return <p className="text-[12px]" style={{ color: 'var(--muted)' }}>Converts DOCX uploads to text; PDFs are read natively by the model.</p>;

    case 'assess':
      return (
        <div className="flex flex-col gap-2">
          <div style={{ width: 280 }}>
            <label className="field-label">Rubric</label>
            <Select
              mono
              fullWidth
              ariaLabel="Rubric"
              placeholder="–"
              value={step.config.rubric}
              onChange={(v) => onChange({ ...step, config: { ...step.config, rubric: v } })}
              options={rubrics.map((r) => ({ value: r.key, label: `${r.label} (${r.key})` }))}
            />
          </div>
          <div>
            <label className="field-label">Prompt override (blank = built-in evidence-only prompt)</label>
            <textarea
              className="field-input"
              rows={3}
              value={step.config.prompt ?? ''}
              onChange={(e) => onChange({ ...step, config: { ...step.config, prompt: e.target.value || undefined } })}
            />
          </div>
        </div>
      );

    case 'coherence':
      return (
        <div>
          <label className="field-label">Prompt override (blank = built-in contradictions + paper-vs-practice prompt)</label>
          <textarea
            className="field-input"
            rows={3}
            value={step.config?.prompt ?? ''}
            onChange={(e) => onChange({ ...step, config: { prompt: e.target.value || undefined } })}
          />
        </div>
      );

    case 'verdict':
      return (
        <div className="flex items-end gap-3">
          <div style={{ width: 130 }}>
            <label className="field-label">Green ≥ (0–1)</label>
            <input
              className="field-input"
              value={String(step.config.thresholds.green)}
              onChange={(e) =>
                onChange({ ...step, config: { thresholds: { ...step.config.thresholds, green: Number(e.target.value) || 0 } } })
              }
            />
          </div>
          <div style={{ width: 130 }}>
            <label className="field-label">Amber ≥ (0–1)</label>
            <input
              className="field-input"
              value={String(step.config.thresholds.amber)}
              onChange={(e) =>
                onChange({ ...step, config: { thresholds: { ...step.config.thresholds, amber: Number(e.target.value) || 0 } } })
              }
            />
          </div>
          <p className="text-[12px] pb-1.5" style={{ color: 'var(--muted)' }}>Below amber = red. Weighted coverage of applicable controls.</p>
        </div>
      );

    case 'report':
      return (
        <ReportSections
          sections={step.config.sections}
          onChange={(sections) => onChange({ ...step, config: { sections } })}
        />
      );

    case 'notify':
      return (
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap gap-3">
            <div style={{ width: 200 }}>
              <label className="field-label">Email field (on the submission)</label>
              <input
                className="field-input mono"
                value={step.config.emailField ?? ''}
                onChange={(e) => onChange({ ...step, config: { ...step.config, emailField: e.target.value || undefined } })}
              />
            </div>
            <div style={{ flex: 1, minWidth: 260 }}>
              <label className="field-label">Subject ({'{{verdict_label}} {{form_label}} {{organisation}}'})</label>
              <input
                className="field-input"
                value={step.config.subject}
                onChange={(e) => onChange({ ...step, config: { ...step.config, subject: e.target.value } })}
              />
            </div>
          </div>
          <div>
            <label className="field-label">CTAs (label + link)</label>
            <div className="flex flex-col gap-2">
              {step.config.ctas.map((c, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input
                    className="field-input"
                    style={{ width: 220 }}
                    value={c.label}
                    aria-label="CTA label"
                    onChange={(e) =>
                      onChange({
                        ...step,
                        config: { ...step.config, ctas: step.config.ctas.map((x, idx) => (idx === i ? { ...x, label: e.target.value } : x)) },
                      })
                    }
                  />
                  <input
                    className="field-input mono"
                    style={{ flex: 1 }}
                    value={c.href}
                    aria-label="CTA link"
                    onChange={(e) =>
                      onChange({
                        ...step,
                        config: { ...step.config, ctas: step.config.ctas.map((x, idx) => (idx === i ? { ...x, href: e.target.value } : x)) },
                      })
                    }
                  />
                  <button
                    type="button"
                    className="muted-link"
                    aria-label="Remove CTA"
                    title="Remove CTA"
                    onClick={() => onChange({ ...step, config: { ...step.config, ctas: step.config.ctas.filter((_, idx) => idx !== i) } })}
                  >
                    ✕
                  </button>
                </div>
              ))}
              <button
                type="button"
                className="btn btn-ghost btn-sm self-start"
                onClick={() => onChange({ ...step, config: { ...step.config, ctas: [...step.config.ctas, { label: '', href: '' }] } })}
              >
                + Add CTA
              </button>
            </div>
          </div>
        </div>
      );

    default:
      return null;
  }
}

const SECTION_SOURCES = [
  { value: 'verdict', label: 'verdict (counts)' },
  { value: 'findings', label: 'findings (per control)' },
  { value: 'coherence', label: 'coherence' },
  { value: 'llm', label: 'llm (written prose)' },
];

/**
 * A fresh, non-colliding section key ("section-2", "section-3", …) —
 * report output is merged by key (ReportRunOutput, workflows/types.ts), so a
 * blank/colliding default (the old `key: ''`) silently drops one section's
 * content. Skips any key already in use, including ones an admin hand-edited
 * to match the "section-N" pattern.
 */
function nextSectionKey(sections: ReportSection[]): string {
  const existing = new Set(sections.map((s) => s.key));
  let n = sections.length + 1;
  while (existing.has(`section-${n}`)) n += 1;
  return `section-${n}`;
}

function ReportSections({
  sections,
  onChange,
}: {
  sections: ReportSection[];
  onChange: (s: ReportSection[]) => void;
}) {
  function patch(i: number, p: Partial<ReportSection>) {
    onChange(sections.map((s, idx) => (idx === i ? { ...s, ...p } : s)));
  }
  return (
    <div className="flex flex-col gap-2">
      {sections.map((s, i) => (
        <div key={i} className="flex flex-col gap-1.5" style={{ borderTop: '1px solid var(--line)', paddingTop: 8 }}>
          <div className="flex items-center gap-2">
            <input className="field-input mono" style={{ width: 120 }} value={s.key} placeholder="key" aria-label="Section key"
              onChange={(e) => patch(i, { key: e.target.value })} />
            <input className="field-input" style={{ flex: 1 }} value={s.title} placeholder="Section title" aria-label="Section title"
              onChange={(e) => patch(i, { title: e.target.value })} />
            <Select
              mono
              value={s.source}
              ariaLabel="Section source"
              onChange={(v) => patch(i, { source: v as ReportSection['source'] })}
              options={SECTION_SOURCES}
            />
            <input className="field-input" style={{ width: 70 }} value={s.maxItems != null ? String(s.maxItems) : ''} placeholder="max" aria-label="Max items"
              onChange={(e) => patch(i, { maxItems: e.target.value === '' ? undefined : Number(e.target.value) || undefined })} />
            <button type="button" className="muted-link" aria-label="Remove section" title="Remove section" onClick={() => onChange(sections.filter((_, idx) => idx !== i))}>
              ✕
            </button>
          </div>
          {s.source === 'llm' && (
            <textarea
              className="field-input"
              rows={2}
              placeholder="Composition prompt for this section"
              value={s.prompt ?? ''}
              onChange={(e) => patch(i, { prompt: e.target.value || undefined })}
            />
          )}
          <div className="flex flex-wrap items-center gap-4">
            {(s.source === 'verdict' || s.source === 'findings') && (
              <div style={{ width: 160 }}>
                <label className="field-label">Display</label>
                <Select
                  mono
                  fullWidth
                  ariaLabel={s.source === 'verdict' ? 'Verdict display' : 'Findings display'}
                  value={s.display ?? 'inline'}
                  onChange={(v) => patch(i, { display: v as ReportSection['display'] })}
                  options={
                    s.source === 'verdict'
                      ? [
                          { value: 'inline', label: 'Inline (today)' },
                          { value: 'tiles', label: 'Tiles' },
                        ]
                      : [
                          { value: 'inline', label: 'Stacked (today)' },
                          { value: 'tabs', label: 'Tabs' },
                        ]
                  }
                />
              </div>
            )}
            {s.source === 'findings' && (
              <>
                <label className="check">
                  <input
                    type="checkbox"
                    checked={s.showControlIds ?? true}
                    onChange={(e) => patch(i, { showControlIds: e.target.checked })}
                  />
                  Show control IDs
                </label>
                <label className="check">
                  <input
                    type="checkbox"
                    checked={s.showSummaries ?? false}
                    onChange={(e) => patch(i, { showSummaries: e.target.checked })}
                  />
                  Show principle summaries
                </label>
              </>
            )}
            <label className="check">
              <input
                type="checkbox"
                checked={s.collapsed ?? false}
                onChange={(e) => patch(i, { collapsed: e.target.checked })}
              />
              Collapsed by default
            </label>
          </div>
        </div>
      ))}
      <button
        type="button"
        className="btn btn-ghost btn-sm self-start"
        onClick={() => onChange([...sections, { key: nextSectionKey(sections), title: '', source: 'llm' }])}
      >
        + Add section
      </button>
    </div>
  );
}
