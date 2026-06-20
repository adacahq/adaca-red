'use client';

import { useState } from 'react';
import { Bars2Icon, XMarkIcon, PlusIcon } from '@heroicons/react/20/solid';
import Select from './Select';
import { childTypesOf, addableViews, VIEW_BY_KIND } from '@/lib/views/registry';
import { deriveStructural } from '@/lib/views/tabs';
import { fieldsOf } from '@/lib/definitions/server';
import type { DefinitionRow, TabSpec, ViewKind } from '@/lib/supabase/types';

interface Row {
  id: string;
  kind: ViewKind;
  ref?: string;
  /** Structural tabs are derived defaults — they can be hidden/renamed/reordered
   *  but not removed (they reappear from the definition graph). */
  derived: boolean;
  label: string;
  defaultLabel: string;
  hidden: boolean;
  config?: Record<string, unknown>;
}

/** Merge the stored overlay with the derived structural defaults into editable
 *  rows (mirrors `nodeTabs`' merge). Round-trips: emit → value → buildRows. */
function buildRows(def: DefinitionRow, defs: Record<string, DefinitionRow>, value: TabSpec[]): Row[] {
  const derived = deriveStructural(def, defs);
  const byRef = new Map(derived.map((d) => [d.ref, d]));
  const consumed = new Set<string>();
  const rows: Row[] = [];

  for (const spec of value) {
    if (spec.ref && byRef.has(spec.ref)) {
      const d = byRef.get(spec.ref)!;
      consumed.add(spec.ref);
      rows.push({ id: spec.id, kind: d.kind, ref: spec.ref, derived: true, label: spec.label ?? d.defaultLabel, defaultLabel: d.defaultLabel, hidden: !!spec.hidden, config: spec.config });
    } else if (spec.kind && !spec.ref) {
      const meta = VIEW_BY_KIND[spec.kind];
      rows.push({ id: spec.id, kind: spec.kind, derived: false, label: spec.label ?? meta?.title ?? spec.kind, defaultLabel: meta?.title ?? spec.kind, hidden: !!spec.hidden, config: spec.config });
    }
  }
  for (const d of derived) {
    if (!consumed.has(d.ref)) rows.push({ id: d.ref, kind: d.kind, ref: d.ref, derived: true, label: d.defaultLabel, defaultLabel: d.defaultLabel, hidden: false });
  }
  return rows;
}

function toSpecs(rows: Row[]): TabSpec[] {
  return rows.map((r) => ({
    id: r.id,
    ref: r.derived ? r.ref : undefined,
    kind: r.derived ? undefined : r.kind,
    label: r.label && r.label !== r.defaultLabel ? r.label : undefined,
    hidden: r.hidden || undefined,
    config: r.config && Object.keys(r.config).length ? r.config : undefined,
  }));
}

/**
 * Definition-level editor for a node type's detail-screen tabs. Shows the derived
 * structural tabs (Overview / children / edges / Activity) plus any added views
 * (board / RED / timeline), drag-reorderable, hide/rename, and an "add view"
 * picker gated by each view's availability for this type. Emits `config.tabs`.
 */
export default function TabsEditor({
  def,
  defs,
  value,
  onChange,
}: {
  def: DefinitionRow;
  defs: Record<string, DefinitionRow>;
  value: TabSpec[];
  onChange: (v: TabSpec[]) => void;
}) {
  const rows = buildRows(def, defs, value);
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [overIdx, setOverIdx] = useState<number | null>(null);
  const [pick, setPick] = useState('');

  const emit = (next: Row[]) => onChange(toSpecs(next));
  const patch = (i: number, p: Partial<Row>) => emit(rows.map((r, idx) => (idx === i ? { ...r, ...p } : r)));
  const patchConfig = (i: number, p: Record<string, unknown>) =>
    patch(i, { config: { ...(rows[i].config ?? {}), ...p } });
  const remove = (i: number) => emit(rows.filter((_, idx) => idx !== i));
  function reorder(from: number, to: number) {
    if (from === to) return;
    const next = [...rows];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    emit(next);
  }
  function addView(kind: ViewKind) {
    const meta = VIEW_BY_KIND[kind];
    // Deterministic unique id: one past the largest numeric suffix already present.
    const max = rows.reduce((m, r) => {
      const n = /(\d+)$/.exec(r.id);
      return n ? Math.max(m, Number(n[1])) : m;
    }, 0);
    const id = `view-${max + 1}`;
    emit([...rows, { id, kind, derived: false, label: meta?.title ?? kind, defaultLabel: meta?.title ?? kind, hidden: false }]);
  }

  const childOptions = childTypesOf(def, defs).map((c) => ({ value: c.key, label: c.label }));
  const addable = addableViews({ def, defs });

  // Aligned table columns: handle · label · type · hidden · remove. The remove
  // column is always reserved (empty for derived rows) so the hidden checkbox
  // never shifts between rows.
  const COLS = '18px minmax(0, 1fr) 120px 74px 20px';

  return (
    <div style={{ borderTop: '1px solid var(--line)' }}>
      <div
        className="mono"
        style={{ display: 'grid', gridTemplateColumns: COLS, alignItems: 'center', columnGap: 12, padding: '6px 0', fontSize: 9, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--muted-2)', borderBottom: '1px solid var(--line)' }}
      >
        <span />
        <span>Tab</span>
        <span>Type</span>
        <span>Hidden</span>
        <span />
      </div>

      {rows.map((r, i) => {
        const childType = (r.config?.childType as string | undefined) ?? '';
        const groupByOptions = childType && defs[childType]
          ? fieldsOf(defs[childType]).filter((f) => f.data_type === 'enum').map((f) => ({ value: f.key, label: f.label }))
          : [];
        return (
          <div
            key={r.id}
            style={{ borderBottom: '1px solid var(--line)', boxShadow: overIdx === i && dragIdx !== i ? 'inset 0 2px 0 var(--accent)' : undefined }}
            onDragOver={(e) => {
              if (dragIdx === null) return;
              e.preventDefault();
              if (overIdx !== i) setOverIdx(i);
            }}
            onDrop={() => {
              if (dragIdx !== null) reorder(dragIdx, i);
              setDragIdx(null);
              setOverIdx(null);
            }}
          >
            <div
              style={{ display: 'grid', gridTemplateColumns: COLS, alignItems: 'center', columnGap: 12, padding: '7px 0', opacity: r.hidden ? 0.5 : 1 }}
            >
              <span
                draggable
                onDragStart={() => setDragIdx(i)}
                onDragEnd={() => {
                  setDragIdx(null);
                  setOverIdx(null);
                }}
                title="Drag to reorder"
                style={{ cursor: 'grab', color: 'var(--muted-2)' }}
              >
                <Bars2Icon className="h-4 w-4" aria-hidden />
              </span>
              <input
                className="field-input"
                value={r.label}
                placeholder={r.defaultLabel}
                onChange={(e) => patch(i, { label: e.target.value })}
              />
              <span className="mono" style={{ fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--muted-2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {r.kind}{r.derived ? '' : ' · added'}
              </span>
              <label className="flex items-center gap-1.5 text-[12px]" style={{ color: 'var(--muted)' }}>
                <input type="checkbox" checked={r.hidden} onChange={(e) => patch(i, { hidden: e.target.checked })} />
                <span className="sr-only">hidden</span>
              </label>
              {!r.derived ? (
                <button type="button" className="muted-link" title="Remove view" onClick={() => remove(i)}>
                  <XMarkIcon className="h-4 w-4" aria-hidden />
                </button>
              ) : (
                <span aria-hidden />
              )}
            </div>

            {r.kind === 'board' && !r.derived && (
              <div className="flex items-center gap-2" style={{ padding: '0 0 8px 30px' }}>
                <div style={{ width: 170 }}>
                  <Select
                    fullWidth
                    value={childType}
                    onChange={(v) => patchConfig(i, { childType: v, groupBy: undefined })}
                    options={childOptions}
                    placeholder="Child type"
                    ariaLabel="Board child type"
                  />
                </div>
                <div style={{ width: 150 }}>
                  <Select
                    fullWidth
                    value={(r.config?.groupBy as string | undefined) ?? ''}
                    onChange={(v) => patchConfig(i, { groupBy: v })}
                    options={groupByOptions}
                    placeholder="Group by"
                    ariaLabel="Board group-by field"
                  />
                </div>
              </div>
            )}
          </div>
        );
      })}

      {addable.length > 0 && (
        <div className="mt-3 flex items-center gap-2">
          <div style={{ width: 200 }}>
            <Select
              fullWidth
              value={pick}
              onChange={setPick}
              options={addable.map((v) => ({ value: v.kind, label: v.title }))}
              placeholder="Add a view…"
              ariaLabel="Add a view"
            />
          </div>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            disabled={!pick}
            onClick={() => {
              if (pick) addView(pick as ViewKind);
              setPick('');
            }}
          >
            <PlusIcon className="h-4 w-4" aria-hidden /> Add view
          </button>
        </div>
      )}
    </div>
  );
}
