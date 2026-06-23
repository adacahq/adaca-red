'use client';

import { useMemo, useState, type CSSProperties, type ReactNode } from 'react';
import { ChevronUpIcon, ChevronDownIcon, ChevronUpDownIcon } from '@heroicons/react/20/solid';

export interface Column<T> {
  key: string;
  header: ReactNode;
  cell: (row: T) => ReactNode;
  /** Return a comparable value to make this column sortable. Omit = not sortable. */
  sortValue?: (row: T) => string | number | boolean | null | undefined;
  align?: 'left' | 'right' | 'center';
  /** Render the cell text in the mono face. */
  mono?: boolean;
  cellStyle?: CSSProperties;
  headerStyle?: CSSProperties;
}

const TH: CSSProperties = {
  fontSize: 10,
  letterSpacing: '0.06em',
  textTransform: 'uppercase',
  color: 'var(--muted)',
  padding: '10px 14px',
  background: 'var(--bg-alt)',
  borderBottom: '1px solid var(--line)',
  whiteSpace: 'nowrap',
};
const TD: CSSProperties = { padding: '12px 14px', borderBottom: '1px solid var(--line)' };

/** Mixed null/number/string comparison; empties sort last, numbers numerically,
 *  strings naturally (so "9" < "10"). */
function cmp(a: unknown, b: unknown): number {
  const ae = a === null || a === undefined || a === '';
  const be = b === null || b === undefined || b === '';
  if (ae && be) return 0;
  if (ae) return 1;
  if (be) return -1;
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  return String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: 'base' });
}

function SortGlyph({ dir }: { dir: 'asc' | 'desc' | null }) {
  if (dir === 'asc') return <ChevronUpIcon className="h-3 w-3" style={{ color: 'var(--accent)' }} aria-hidden />;
  if (dir === 'desc') return <ChevronDownIcon className="h-3 w-3" style={{ color: 'var(--accent)' }} aria-hidden />;
  return <ChevronUpDownIcon className="h-3 w-3" style={{ color: 'var(--muted-2)', opacity: 0.5 }} aria-hidden />;
}

/**
 * Hairline data table with client-side, type-aware column sorting. Sort state is
 * local React state, so a full page refresh resets it; it survives soft
 * navigation / client pagination (same component instance) by design.
 *
 * A column is sortable iff it provides `sortValue`. Header clicks cycle
 * unsorted → ascending → descending → unsorted.
 */
export default function DataTable<T>({
  columns,
  rows,
  getRowKey,
  empty = 'Nothing here.',
  className = '',
  textSize = 14,
}: {
  columns: Column<T>[];
  rows: T[];
  getRowKey?: (row: T, i: number) => string | number;
  empty?: ReactNode;
  className?: string;
  textSize?: number;
}) {
  const [sort, setSort] = useState<{ key: string; dir: 'asc' | 'desc' } | null>(null);

  const sorted = useMemo(() => {
    if (!sort) return rows;
    const col = columns.find((c) => c.key === sort.key);
    if (!col?.sortValue) return rows;
    const sv = col.sortValue;
    const dir = sort.dir === 'asc' ? 1 : -1;
    return [...rows].sort((a, b) => cmp(sv(a), sv(b)) * dir);
  }, [rows, sort, columns]);

  function toggle(key: string) {
    setSort((s) => {
      if (!s || s.key !== key) return { key, dir: 'asc' };
      if (s.dir === 'asc') return { key, dir: 'desc' };
      return null;
    });
  }

  return (
    <table className={`w-full ${className}`} style={{ borderCollapse: 'collapse', fontSize: textSize }}>
      <thead>
        <tr>
          {columns.map((c) => {
            const sortable = !!c.sortValue;
            const active = sort?.key === c.key ? sort : null;
            const align = c.align ?? 'left';
            return (
              <th
                key={c.key}
                className="mono"
                style={{ ...TH, textAlign: align, cursor: sortable ? 'pointer' : 'default', userSelect: 'none', ...c.headerStyle }}
                onClick={sortable ? () => toggle(c.key) : undefined}
                aria-sort={active ? (active.dir === 'asc' ? 'ascending' : 'descending') : undefined}
              >
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                    width: '100%',
                    justifyContent: align === 'right' ? 'flex-end' : align === 'center' ? 'center' : 'flex-start',
                  }}
                >
                  {c.header}
                  {sortable && <SortGlyph dir={active ? active.dir : null} />}
                </span>
              </th>
            );
          })}
        </tr>
      </thead>
      <tbody>
        {sorted.map((row, i) => (
          <tr key={getRowKey ? getRowKey(row, i) : i}>
            {columns.map((c) => (
              <td
                key={c.key}
                className={c.mono ? 'mono' : undefined}
                style={{ ...TD, textAlign: c.align ?? 'left', ...c.cellStyle }}
              >
                {c.cell(row)}
              </td>
            ))}
          </tr>
        ))}
        {sorted.length === 0 && (
          <tr>
            <td colSpan={columns.length} style={{ padding: '24px 14px', color: 'var(--muted-2)' }}>
              {empty}
            </td>
          </tr>
        )}
      </tbody>
    </table>
  );
}
