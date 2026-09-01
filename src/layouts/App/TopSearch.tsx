'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
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
        style={{ fontSize: 13, padding: '8px 12px' }}
        aria-label="Search"
        autoComplete="off"
      />

      {showPanel && (
        <div className="tbpanel w-[min(420px,90vw)]">
          {loading && flat.length === 0 && <p className="mono-micro px-2 py-2">Searching…</p>}
          {!loading && flat.length === 0 && (
            <p className="mono-micro px-2 py-2">No matches for &ldquo;{q.trim()}&rdquo;.</p>
          )}
          <div className="max-h-[360px] overflow-y-auto">
            {groups.map((g, gi) => (
              <div key={g.key}>
                <p className="mono-micro px-2 pb-1 pt-2">{g.label}</p>
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
                      className="tbrow w-full justify-between"
                      style={{ background: active === i ? 'var(--ghost)' : undefined }}
                    >
                      <span className="flex-1 truncate text-left">{r.title}</span>
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
              className="tbrow w-full justify-between"
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
