'use client';

import { useState } from 'react';
import { Bars2Icon } from '@heroicons/react/20/solid';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
import type { ForYouConfig as Config } from '@/lib/forYou/types';

export interface ColumnOption {
  key: string;
  label: string;
}
export interface TypeOption {
  key: string;
  label: string;
}

/** Per-user config for the For You table: which node types to include and which
 *  columns to show (drag to reorder, mirroring ChoicesEditor/TabsEditor). */
export default function ForYouConfig({
  open,
  onClose,
  typeOptions,
  columnOptions,
  config,
  onSave,
}: {
  open: boolean;
  onClose: () => void;
  typeOptions: TypeOption[];
  columnOptions: ColumnOption[];
  config: Config;
  onSave: (next: Config) => void;
}) {
  const allTypes = typeOptions.map((t) => t.key);
  const allCols = columnOptions.map((c) => c.key);
  const [types, setTypes] = useState<string[]>(config.types ?? allTypes);
  // Ordered column keys: saved order first, then any not-yet-saved columns.
  const initialOrder = config.columns
    ? [...config.columns.filter((k) => allCols.includes(k)), ...allCols.filter((k) => !config.columns?.includes(k))]
    : allCols;
  const [order, setOrder] = useState<string[]>(initialOrder);
  const [selected, setSelected] = useState<string[]>(config.columns ?? allCols);
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [overIdx, setOverIdx] = useState<number | null>(null);

  const labelOf = Object.fromEntries(columnOptions.map((c) => [c.key, c.label]));

  function toggleType(key: string) {
    setTypes((t) => (t.includes(key) ? t.filter((x) => x !== key) : [...t, key]));
  }
  function toggleCol(key: string) {
    setSelected((s) => (s.includes(key) ? s.filter((x) => x !== key) : [...s, key]));
  }
  function reorder(from: number, to: number) {
    if (from === to) return;
    const next = [...order];
    const [m] = next.splice(from, 1);
    next.splice(to, 0, m);
    setOrder(next);
  }
  function save() {
    // Persist the selected columns in the current drag order.
    const columns = order.filter((k) => selected.includes(k));
    onSave({ columns, types });
    onClose();
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Configure For You"
      maxWidth={560}
      footer={
        <>
          <Button variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
          <Button variant="primary" size="sm" onClick={save}>Save</Button>
        </>
      }
    >
      {typeOptions.length > 1 && (
        <div className="mb-7">
          <p className="field-label">Types</p>
          <div className="flex flex-wrap gap-x-5 gap-y-2">
            {typeOptions.map((t) => (
              <label key={t.key} className="flex items-center gap-2 text-[13px]" style={{ color: 'var(--ink)' }}>
                <input type="checkbox" checked={types.includes(t.key)} onChange={() => toggleType(t.key)} />
                {t.label}
              </label>
            ))}
          </div>
        </div>
      )}

      <p className="field-label">Columns (drag to reorder)</p>
      <div style={{ borderTop: '1px solid var(--line)' }}>
        {order.map((key, i) => (
          <div
            key={key}
            className="flex items-center gap-2 py-1.5"
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
            <label className="flex items-center gap-2 text-[13px]" style={{ color: 'var(--ink)', flex: 1 }}>
              <input type="checkbox" checked={selected.includes(key)} onChange={() => toggleCol(key)} />
              {labelOf[key] ?? key}
            </label>
          </div>
        ))}
      </div>
    </Modal>
  );
}
