'use client';

import { useState } from 'react';
import { Bars2Icon, XMarkIcon, PlusIcon } from '@heroicons/react/20/solid';
import Select from './Select';
import { TONES, TONE_LABEL, TONE_COLOR, humanizeKey, type Tone } from '@/lib/definitions/choices';
import type { ChoiceOption } from '@/lib/supabase/types';

interface Row { key: string; label: string; tone: Tone }

function toRow(c: ChoiceOption | string): Row {
  if (typeof c === 'string') return { key: c, label: humanizeKey(c), tone: 'neutral' };
  return { key: c.key, label: c.label ?? humanizeKey(c.key), tone: c.tone ?? 'neutral' };
}

/**
 * Editor for an enum field's choices: each choice has a stable key (stored
 * value), a display label, and a tone (semantic colour). Rows are drag-
 * reorderable — order drives the kanban column order and dropdown order.
 */
export default function ChoicesEditor({
  value,
  onChange,
}: {
  value: (ChoiceOption | string)[];
  onChange: (v: ChoiceOption[]) => void;
}) {
  const rows = value.map(toRow);
  const [draft, setDraft] = useState('');
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [overIdx, setOverIdx] = useState<number | null>(null);

  function emit(next: Row[]) {
    onChange(next.map((r) => ({ key: r.key.trim(), label: r.label.trim() || undefined, tone: r.tone })));
  }
  function patch(i: number, p: Partial<Row>) {
    emit(rows.map((r, idx) => (idx === i ? { ...r, ...p } : r)));
  }
  function remove(i: number) {
    emit(rows.filter((_, idx) => idx !== i));
  }
  function add() {
    const key = draft.trim();
    if (!key || rows.some((r) => r.key === key)) {
      setDraft('');
      return;
    }
    emit([...rows, { key, label: humanizeKey(key), tone: 'neutral' }]);
    setDraft('');
  }
  function reorder(from: number, to: number) {
    if (from === to) return;
    const next = [...rows];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    emit(next);
  }

  return (
    <div className="flex flex-col gap-1.5">
      {rows.map((r, i) => (
        <div
          key={i}
          className="flex items-center gap-2"
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
          style={{ boxShadow: overIdx === i && dragIdx !== i ? 'inset 0 2px 0 var(--accent)' : undefined }}
        >
          <span
            draggable
            onDragStart={() => setDragIdx(i)}
            onDragEnd={() => {
              setDragIdx(null);
              setOverIdx(null);
            }}
            title="Drag to reorder"
            className="shrink-0"
            style={{ cursor: 'grab', color: 'var(--muted-2)', opacity: dragIdx === i ? 0.4 : 1 }}
          >
            <Bars2Icon className="h-4 w-4" aria-hidden />
          </span>
          <input
            className="field-input mono"
            style={{ width: 130 }}
            value={r.key}
            placeholder="key"
            onChange={(e) => patch(i, { key: e.target.value })}
          />
          <input
            className="field-input"
            style={{ flex: 1, minWidth: 90 }}
            value={r.label}
            placeholder="Label"
            onChange={(e) => patch(i, { label: e.target.value })}
          />
          <div style={{ width: 132 }}>
            <Select
              fullWidth
              value={r.tone}
              onChange={(v) => patch(i, { tone: v as Tone })}
              options={TONES.map((t) => ({ value: t, label: TONE_LABEL[t] }))}
              ariaLabel={`Tone for ${r.key}`}
            />
          </div>
          <span aria-hidden style={{ width: 8, height: 8, borderRadius: '50%', background: TONE_COLOR[r.tone], flexShrink: 0 }} />
          <button type="button" className="muted-link shrink-0" title="Remove" onClick={() => remove(i)}>
            <XMarkIcon className="h-4 w-4" aria-hidden />
          </button>
        </div>
      ))}

      <div className="mt-1 flex items-center gap-2">
        <input
          className="field-input mono"
          style={{ width: 130 }}
          value={draft}
          placeholder="new key"
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              add();
            }
          }}
        />
        <button type="button" className="btn btn-ghost btn-sm" onClick={add} disabled={!draft.trim()}>
          <PlusIcon className="h-4 w-4" aria-hidden /> Add choice
        </button>
      </div>
    </div>
  );
}
