'use client';

import { useState, useTransition, type CSSProperties } from 'react';
import { useRouter } from 'next/navigation';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
import Select from '@/components/ui/Select';
import DataTable, { type Column } from '@/components/ui/DataTable';
import EmptyState from '@/components/ui/EmptyState';
import { useConfirm } from '@/components/ui/Confirm';
import { TONES, TONE_LABEL } from '@/lib/definitions/choices';
import type {
  ChoiceTone,
  DefinitionRow,
  Json,
  RubricConfig,
  RubricPrinciple,
  RubricRating,
} from '@/lib/supabase/types';
import { createDefinition, deleteDefinition, saveDefinition } from '@/lib/definitions/actions';
import AdminNav from '../AdminNav';

const REVALIDATE = '/admin/rubrics';

const DEFAULT_RATINGS: RubricRating[] = [
  { key: 'covered', label: 'Covered', score: 2, tone: 'ok' },
  { key: 'partial', label: 'Partially covered', score: 1, tone: 'warn' },
  { key: 'not_covered', label: 'Not covered', score: 0, tone: 'crit' },
  { key: 'not_applicable', label: 'Not applicable', score: null, tone: 'neutral' },
];

export default function RubricsEditor({ rubrics }: { rubrics: DefinitionRow[] }) {
  const [editing, setEditing] = useState<DefinitionRow | null>(null);
  const [creating, setCreating] = useState(false);
  const router = useRouter();
  const confirm = useConfirm();
  const [, startTransition] = useTransition();

  async function remove(def: DefinitionRow) {
    const ok = await confirm({
      title: 'Delete rubric',
      body: `Delete “${def.label}”? Workflows referencing it will fail until repointed. Issued assessments keep their snapshots.`,
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
      header: 'Rubric',
      cell: (def) => (
        <div>
          <div style={{ color: 'var(--fg)', fontWeight: 500 }}>{def.label}</div>
          <div className="mono" style={{ fontSize: 11, color: 'var(--muted)' }}>{def.key}</div>
        </div>
      ),
      sortValue: (def) => def.label.toLowerCase(),
    },
    {
      key: 'counts',
      header: 'Coverage',
      mono: true,
      cellStyle: { color: 'var(--muted)' },
      cell: (def) => {
        const config = (def.config ?? {}) as unknown as RubricConfig;
        const controls = (config.principles ?? []).reduce((n, p) => n + p.controls.length, 0);
        return `${(config.principles ?? []).length} principles · ${controls} controls`;
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
        <h1 className="view-title rv" style={{ '--i': 1 } as CSSProperties}>Rubrics</h1>
        <span className="rv" style={{ '--i': 2 } as CSSProperties}>
          <Button variant="primary" size="sm" onClick={() => setCreating(true)}>New rubric</Button>
        </span>
      </div>
      <p className="lede rv" style={{ '--i': 2 } as CSSProperties}>
        The standards submissions are assessed against — principles, controls and the
        rating scale. Edits apply to the next run immediately, with no deploy; issued
        assessments keep a snapshot of the structure they were scored with, so past
        results never shift under a reader.
      </p>

      <AdminNav />

      <div className="mt-10 rv" style={{ '--i': 3 } as CSSProperties}>
        {rubrics.length === 0 ? (
          <EmptyState eyebrow="Rubrics" title="No rubrics yet" description="Create one with New rubric, above." />
        ) : (
          <DataTable columns={cols} rows={rubrics} getRowKey={(d) => d.id} empty="No rubrics yet." />
        )}
      </div>

      {(editing || creating) && (
        <RubricModal
          definition={editing}
          onClose={() => {
            setEditing(null);
            setCreating(false);
          }}
        />
      )}
    </div>
  );
}

function RubricModal({ definition, onClose }: { definition: DefinitionRow | null; onClose: () => void }) {
  const router = useRouter();
  const initial = definition ? ((definition.config ?? {}) as unknown as RubricConfig) : null;
  const [key, setKey] = useState(definition?.key ?? '');
  const [label, setLabel] = useState(definition?.label ?? '');
  const [ratings, setRatings] = useState<RubricRating[]>(initial?.ratings ?? DEFAULT_RATINGS);
  const [principles, setPrinciples] = useState<RubricPrinciple[]>(initial?.principles ?? []);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function patchPrinciple(i: number, p: Partial<RubricPrinciple>) {
    setPrinciples((ps) => ps.map((x, idx) => (idx === i ? { ...x, ...p } : x)));
  }
  function movePrinciple(i: number, dir: -1 | 1) {
    setPrinciples((ps) => {
      const j = i + dir;
      if (j < 0 || j >= ps.length) return ps;
      const next = [...ps];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  }
  function patchControl(pi: number, ci: number, patch: Partial<RubricPrinciple['controls'][number]>) {
    setPrinciples((ps) =>
      ps.map((p, idx) =>
        idx === pi
          ? { ...p, controls: p.controls.map((c, cdx) => (cdx === ci ? { ...c, ...patch } : c)) }
          : p,
      ),
    );
  }

  function save() {
    setError(null);
    if (!label.trim() || (!definition && !key.trim())) {
      setError('Key and label are required.');
      return;
    }
    for (const p of principles) {
      if (!p.key.trim() || !p.label.trim()) {
        setError('Every principle needs a key and a label.');
        return;
      }
      for (const c of p.controls) {
        if (!c.key.trim() || !c.label.trim()) {
          setError(`Every control under ${p.key} needs a key and a label.`);
          return;
        }
      }
    }
    // Assess output is keyed by principle key (the byPrinciple owned-key
    // merge — see steps.ts's runAssess): a duplicate silently loses one
    // principle's findings with no error anywhere, so this has to be caught
    // here, before save.
    const seenPrincipleKeys = new Set<string>();
    for (const p of principles) {
      const k = p.key.trim();
      if (seenPrincipleKeys.has(k)) {
        setError(`Duplicate principle key: ${k}. Principle keys must be unique — a duplicate silently loses one principle's findings.`);
        return;
      }
      seenPrincipleKeys.add(k);
    }
    const allKeys = principles.flatMap((p) => p.controls.map((c) => c.key.trim()));
    if (new Set(allKeys).size !== allKeys.length) {
      setError('Control keys must be unique across the whole rubric.');
      return;
    }
    const config = { ratings, principles } as unknown as Json;
    startTransition(async () => {
      try {
        if (definition) {
          await saveDefinition({ id: definition.id, label: label.trim(), config, revalidate: REVALIDATE });
        } else {
          await createDefinition({ kind: 'rubric', key: key.trim(), label: label.trim(), config, revalidate: REVALIDATE });
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
      title={definition ? `Edit rubric · ${definition.key}` : 'New rubric'}
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
            <input className="field-input" value={key} onChange={(e) => setKey(e.target.value)} placeholder="rai_standard" />
          </div>
        )}
        <div style={{ flex: 1, minWidth: 240 }}>
          <label className="field-label">Label</label>
          <input className="field-input" value={label} onChange={(e) => setLabel(e.target.value)} />
        </div>
      </div>

      <p className="field-label">Rating scale (key · label · score · colour)</p>
      <div className="mb-6 flex flex-col gap-2">
        {ratings.map((r, i) => (
          <div key={i} className="flex flex-col gap-1.5">
            <div className="flex items-center gap-2">
              <input className="field-input" style={{ width: 140 }} value={r.key} aria-label="Rating key"
                onChange={(e) => setRatings((rs) => rs.map((x, idx) => (idx === i ? { ...x, key: e.target.value } : x)))} />
              <input className="field-input" style={{ flex: 1 }} value={r.label} aria-label="Rating label"
                onChange={(e) => setRatings((rs) => rs.map((x, idx) => (idx === i ? { ...x, label: e.target.value } : x)))} />
              <input className="field-input" style={{ width: 70 }} value={r.score === null ? '' : String(r.score)} placeholder="n/a" aria-label="Rating score"
                onChange={(e) =>
                  setRatings((rs) =>
                    rs.map((x, idx) =>
                      idx === i ? { ...x, score: e.target.value === '' ? null : Number(e.target.value) || 0 } : x,
                    ),
                  )
                } />
              <Select
                mono
                value={r.tone}
                ariaLabel="Rating colour"
                onChange={(v) => setRatings((rs) => rs.map((x, idx) => (idx === i ? { ...x, tone: v as ChoiceTone } : x)))}
                options={TONES.map((t) => ({ value: t, label: TONE_LABEL[t] }))}
              />
              <button type="button" className="muted-link" aria-label="Remove rating" title="Remove rating" onClick={() => setRatings((rs) => rs.filter((_, idx) => idx !== i))}>
                ✕
              </button>
            </div>
            <input className="field-input" value={r.guidance ?? ''} placeholder="Next step shown on the score tile" aria-label="Rating guidance"
              onChange={(e) => setRatings((rs) => rs.map((x, idx) => (idx === i ? { ...x, guidance: e.target.value || undefined } : x)))} />
          </div>
        ))}
        <button
          type="button"
          className="btn btn-ghost btn-sm self-start"
          onClick={() => setRatings((rs) => [...rs, { key: '', label: '', score: 0, tone: 'neutral' }])}
        >
          + Add rating
        </button>
        <p className="text-[12px]" style={{ color: 'var(--muted)' }}>
          Score = contribution to coverage (highest score is “fully covered”). Empty score = excluded from the verdict (e.g. not applicable).
        </p>
      </div>

      <p className="field-label">Principles & controls</p>
      <div className="flex flex-col gap-4">
        {principles.map((p, pi) => (
          <div key={pi} style={{ border: '1px solid var(--line)', padding: 14 }}>
            <div className="flex flex-wrap items-end gap-3 mb-3">
              <div style={{ width: 90 }}>
                <label className="field-label">Key</label>
                <input className="field-input" value={p.key} onChange={(e) => patchPrinciple(pi, { key: e.target.value })} />
              </div>
              <div style={{ width: 200 }}>
                <label className="field-label">Label</label>
                <input className="field-input" value={p.label} onChange={(e) => patchPrinciple(pi, { label: e.target.value })} />
              </div>
              <div style={{ flex: 1, minWidth: 220 }}>
                <label className="field-label">Description</label>
                <input className="field-input" value={p.description ?? ''} onChange={(e) => patchPrinciple(pi, { description: e.target.value || undefined })} />
              </div>
              <div className="flex items-center gap-3 pb-1.5">
                <button type="button" className="muted-link" aria-label="Move up" title="Up" onClick={() => movePrinciple(pi, -1)}>↑</button>
                <button type="button" className="muted-link" aria-label="Move down" title="Down" onClick={() => movePrinciple(pi, 1)}>↓</button>
                <button type="button" className="muted-link" aria-label="Remove principle" title="Remove principle" onClick={() => setPrinciples((ps) => ps.filter((_, idx) => idx !== pi))}>
                  ✕
                </button>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              {p.controls.map((c, ci) => (
                <div key={ci} className="flex flex-col gap-1.5" style={{ borderTop: '1px solid var(--line)', paddingTop: 8 }}>
                  <div className="flex items-center gap-2">
                    <input className="field-input" style={{ width: 90 }} value={c.key} placeholder="FA-01" aria-label="Control key"
                      onChange={(e) => patchControl(pi, ci, { key: e.target.value })} />
                    <input className="field-input" style={{ flex: 1 }} value={c.label} placeholder="Control name" aria-label="Control label"
                      onChange={(e) => patchControl(pi, ci, { label: e.target.value })} />
                    <input className="field-input" style={{ width: 70 }} value={c.weight != null ? String(c.weight) : ''} placeholder="wt 1" aria-label="Weight"
                      onChange={(e) => patchControl(pi, ci, { weight: e.target.value === '' ? undefined : Number(e.target.value) || 1 })} />
                    <button type="button" className="muted-link" aria-label="Remove control" title="Remove control"
                      onClick={() => patchPrinciple(pi, { controls: p.controls.filter((_, idx) => idx !== ci) })}>
                      ✕
                    </button>
                  </div>
                  <input className="field-input" value={c.description} placeholder="What the control requires" aria-label="Control description"
                    onChange={(e) => patchControl(pi, ci, { description: e.target.value })} />
                  <input className="field-input" value={c.evidence ?? ''} placeholder="What good evidence looks like (guides the assessor)" aria-label="Evidence guidance"
                    onChange={(e) => patchControl(pi, ci, { evidence: e.target.value || undefined })} />
                </div>
              ))}
              <button
                type="button"
                className="btn btn-ghost btn-sm self-start"
                onClick={() => patchPrinciple(pi, { controls: [...p.controls, { key: '', label: '', description: '' }] })}
              >
                + Add control
              </button>
            </div>
          </div>
        ))}
        <button
          type="button"
          className="btn btn-ghost btn-sm self-start"
          onClick={() => setPrinciples((ps) => [...ps, { key: '', label: '', controls: [] }])}
        >
          + Add principle
        </button>
      </div>
    </Modal>
  );
}
