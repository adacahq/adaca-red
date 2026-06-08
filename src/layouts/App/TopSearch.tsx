'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { MagnifyingGlassIcon } from '@heroicons/react/20/solid';
import { searchAll, type SearchGroup } from '@/lib/nodes/search';
import Chip from '@/components/entity/Chips';

/**
 * Indexed, type-ahead search for the topbar. Results stream into a dropdown
 * grouped by Initiatives / Risks / Incidents; arrow keys move the highlight,
 * Enter opens it (or runs a full search when nothing is highlighted).
 */
export default function TopSearch() {
  const router = useRouter();
  const [q, setQ] = useState('');
  const [groups, setGroups] = useState<SearchGroup[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [active, setActive] = useState(0);
  const boxRef = useRef<HTMLDivElement>(null);

  // Debounced query → server search. All setState happens inside async
  // callbacks (timeout/promise) so nothing fires synchronously in the effect.
  useEffect(() => {
    const query = q.trim();
    if (!query) {
      const id = setTimeout(() => {
        setGroups([]);
        setLoading(false);
      }, 0);
      return () => clearTimeout(id);
    }
    const id = setTimeout(() => {
      setLoading(true);
      searchAll(query)
        .then((g) => {
          setGroups(g);
          setActive(0);
        })
        .finally(() => setLoading(false));
    }, 220);
    return () => clearTimeout(id);
  }, [q]);

  // Close on outside click.
  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const flat: string[] = groups.flatMap((g) => g.rows.map((r) => `${g.base}/${r.id}`));

  function go(href: string) {
    setOpen(false);
    setQ('');
    setGroups([]);
    router.push(href);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setOpen(true);
      setActive((a) => Math.min(a + 1, Math.max(flat.length - 1, 0)));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (flat[active]) go(flat[active]);
      else if (q.trim()) {
        setOpen(false);
        router.push(`/search?q=${encodeURIComponent(q.trim())}`);
      }
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  }

  const showPanel = open && q.trim().length > 0;
  // Flat index where each group's rows begin, so highlight tracking stays pure.
  const groupOffsets = groups.map((_, gi) =>
    groups.slice(0, gi).reduce((n, g) => n + g.rows.length, 0),
  );

  return (
    <div ref={boxRef} className="relative w-full max-w-xs">
      <span
        aria-hidden
        className="pointer-events-none absolute inset-y-0 left-0 flex items-center"
        style={{ paddingLeft: 10, color: 'var(--muted-2)' }}
      >
        <MagnifyingGlassIcon className="h-4 w-4" />
      </span>
      <input
        type="search"
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
        placeholder="Search…"
        className="field-input"
        style={{ fontSize: 13, padding: '6px 11px 6px 32px' }}
        aria-label="Search"
        autoComplete="off"
      />

      {showPanel && (
        <div
          className="absolute left-0 z-[80] mt-1 w-[min(420px,90vw)] overflow-hidden"
          style={{ background: 'var(--bg-elev)', border: '1px solid var(--line-strong)' }}
        >
          {loading && flat.length === 0 && (
            <p className="px-3 py-3 text-[13px]" style={{ color: 'var(--muted-2)' }}>Searching…</p>
          )}
          {!loading && flat.length === 0 && (
            <p className="px-3 py-3 text-[13px]" style={{ color: 'var(--muted-2)' }}>
              No matches for &ldquo;{q.trim()}&rdquo;.
            </p>
          )}
          <div style={{ maxHeight: 360, overflowY: 'auto' }}>
            {groups.map((g, gi) => (
              <div key={g.key}>
                <p
                  className="mono"
                  style={{
                    fontSize: 9,
                    letterSpacing: '0.12em',
                    textTransform: 'uppercase',
                    color: 'var(--muted-2)',
                    padding: '8px 12px 4px',
                    background: 'var(--bg-alt)',
                    borderBottom: '1px solid var(--line)',
                  }}
                >
                  {g.label}
                </p>
                {g.rows.map((r, ri) => {
                  const i = groupOffsets[gi] + ri;
                  const href = `${g.base}/${r.id}`;
                  return (
                    <button
                      key={r.id}
                      type="button"
                      onMouseEnter={() => setActive(i)}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        go(href);
                      }}
                      className="flex w-full items-center gap-2 text-left"
                      style={{
                        padding: '8px 12px',
                        background: active === i ? 'rgba(255,255,255,0.05)' : 'transparent',
                        borderBottom: '1px solid var(--line)',
                      }}
                    >
                      <span style={{ flex: 1, fontSize: 13.5, color: 'var(--ink)' }}>{r.title}</span>
                      {r.status && <Chip value={r.status} />}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
          {flat.length > 0 && (
            <button
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                setOpen(false);
                router.push(`/search?q=${encodeURIComponent(q.trim())}`);
              }}
              className="mono flex w-full items-center justify-between"
              style={{
                fontSize: 10,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                color: 'var(--muted)',
                padding: '9px 12px',
                background: 'var(--bg-alt)',
              }}
            >
              <span>All results</span>
              <span style={{ color: 'var(--accent)' }}>↵</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}
