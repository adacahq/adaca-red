'use client';

import type { ReactNode } from 'react';
import { PencilSquareIcon, XMarkIcon, Bars2Icon, DocumentDuplicateIcon } from '@heroicons/react/20/solid';

/**
 * Widget chrome: a hairline card with a mono title bar. In edit mode it shows a
 * drag handle (`.widget-drag`, the grid's drag selector) plus configure/remove.
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
    <div className="flex h-full flex-col" style={{ border: '1px solid var(--line)', background: 'var(--bg)' }}>
      <header
        className="flex items-center gap-2 px-3 py-2"
        style={{ borderBottom: '1px solid var(--line)', background: 'var(--bg-alt)' }}
      >
        {editing && (
          <span className="widget-drag inline-flex shrink-0" title="Drag to move" style={{ cursor: 'grab', color: 'var(--muted-2)' }}>
            <Bars2Icon className="h-4 w-4" aria-hidden />
          </span>
        )}
        <span
          className="mono"
          style={{ flex: 1, fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
        >
          {title}
        </span>
        {editing && (
          <>
            <button type="button" className="muted-link shrink-0" title="Configure" onClick={onEdit}>
              <PencilSquareIcon className="h-4 w-4" aria-hidden />
            </button>
            <button type="button" className="muted-link shrink-0" title="Duplicate" onClick={onDuplicate}>
              <DocumentDuplicateIcon className="h-4 w-4" aria-hidden />
            </button>
            <button type="button" className="muted-link shrink-0" title="Remove" onClick={onRemove}>
              <XMarkIcon className="h-4 w-4" aria-hidden />
            </button>
          </>
        )}
      </header>
      <div className="relative flex-1" style={{ overflow: 'auto', padding: 12, minHeight: 0 }}>
        {loading ? (
          <div className="flex h-full items-center justify-center text-[12px]" style={{ color: 'var(--muted-2)' }}>Loading…</div>
        ) : error ? (
          <div className="flex h-full items-center justify-center text-[12px]" style={{ color: 'var(--crit)' }}>Couldn’t load</div>
        ) : (
          children
        )}
      </div>
    </div>
  );
}
