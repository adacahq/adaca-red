'use client';

import type { ReactNode } from 'react';

/**
 * Widget chrome: the shared `.chart-card` surface with a `.chart-head` title
 * row (title left, controls right, baseline-aligned). In edit mode it shows
 * a drag handle (`.widget-drag`, the grid's drag selector) plus
 * configure/duplicate/remove.
 */
export default function WidgetCard({
  title,
  editing,
  onEdit,
  onDuplicate,
  onRemove,
  loading,
  error,
  children,
}: {
  title: string;
  editing: boolean;
  onEdit: () => void;
  onDuplicate: () => void;
  onRemove: () => void;
  loading?: boolean;
  error?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="chart-card flex h-full flex-col">
      <div className="chart-head">
        <span className="flex min-w-0 items-center gap-2">
          {editing && (
            <span className="widget-drag shrink-0" title="Drag to move" style={{ cursor: 'grab', color: 'var(--muted)' }}>
              <svg width="12" height="8" viewBox="0 0 12 8" fill="none" aria-hidden>
                <path d="M1 1h10M1 7h10" stroke="currentColor" strokeWidth="1.5" />
              </svg>
            </span>
          )}
          <span className="field-label truncate" style={{ margin: 0 }}>
            {title}
          </span>
        </span>
        {editing && (
          <span className="flex shrink-0 items-center gap-3">
            <button type="button" className="muted-link" title="Configure" aria-label="Configure" onClick={onEdit}>
              Edit
            </button>
            <button type="button" className="muted-link" title="Duplicate" aria-label="Duplicate" onClick={onDuplicate}>
              Copy
            </button>
            <button type="button" className="muted-link" title="Remove" aria-label="Remove" onClick={onRemove}>
              ✕
            </button>
          </span>
        )}
      </div>
      <div className="relative flex-1" style={{ overflow: 'auto', minHeight: 0 }}>
        {loading ? (
          <div className="flex h-full items-center justify-center text-[12px]" style={{ color: 'var(--muted)' }}>Loading…</div>
        ) : error ? (
          <div className="flex h-full items-center justify-center text-[12px]" style={{ color: 'var(--crit)' }}>Couldn’t load</div>
        ) : (
          children
        )}
      </div>
    </div>
  );
}
