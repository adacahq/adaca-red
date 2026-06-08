'use client';

import { KeyboardEvent, useRef, useState } from 'react';
import { XMarkIcon } from '@heroicons/react/20/solid';

/**
 * Chip/tag input for value lists (enum choices, scale labels, type keys).
 * Type and press Enter or comma to add a tag; trims whitespace, dedupes,
 * ignores empties; Backspace on an empty field removes the last tag; pasting a
 * comma-separated string adds them all. Chips are drag-reorderable — the order
 * is meaningful (e.g. enum `choices` order = kanban column order).
 */
export default function TagInput({
  value,
  onChange,
  placeholder = 'Add…',
  mono = true,
}: {
  value: string[];
  onChange: (v: string[]) => void;
  placeholder?: string;
  mono?: boolean;
}) {
  const [draft, setDraft] = useState('');
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [overIdx, setOverIdx] = useState<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  function addTokens(raw: string) {
    const parts = raw.split(',').map((s) => s.trim()).filter(Boolean);
    if (parts.length === 0) return;
    const next = [...value];
    for (const p of parts) if (!next.includes(p)) next.push(p);
    onChange(next);
    setDraft('');
  }

  function reorder(from: number, to: number) {
    if (from === to) return;
    const next = [...value];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    onChange(next);
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      if (draft.trim()) addTokens(draft);
    } else if (e.key === 'Backspace' && draft === '' && value.length) {
      onChange(value.slice(0, -1));
    }
  }

  return (
    <div className="tag-input" onClick={() => inputRef.current?.focus()}>
      {value.map((t, i) => (
        <span
          key={t}
          className={`tag-chip${mono ? ' mono' : ''}`}
          draggable
          onDragStart={() => setDragIdx(i)}
          onDragEnd={() => {
            setDragIdx(null);
            setOverIdx(null);
          }}
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
          title="Drag to reorder"
          style={{
            cursor: 'grab',
            opacity: dragIdx === i ? 0.4 : 1,
            boxShadow: overIdx === i && dragIdx !== i ? 'inset 2px 0 0 var(--accent)' : undefined,
          }}
        >
          {t}
          <button
            type="button"
            aria-label={`Remove ${t}`}
            onClick={(e) => {
              e.stopPropagation();
              onChange(value.filter((x) => x !== t));
            }}
          >
            <XMarkIcon className="h-3 w-3" aria-hidden />
          </button>
        </span>
      ))}
      <input
        ref={inputRef}
        className={mono ? 'mono' : undefined}
        value={draft}
        placeholder={value.length ? '' : placeholder}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={onKeyDown}
        onBlur={() => {
          if (draft.trim()) addTokens(draft);
        }}
        onPaste={(e) => {
          const text = e.clipboardData.getData('text');
          if (text.includes(',')) {
            e.preventDefault();
            addTokens(draft + text);
          }
        }}
      />
    </div>
  );
}
