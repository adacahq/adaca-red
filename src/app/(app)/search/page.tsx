import Link from 'next/link';
import type { CSSProperties } from 'react';
import { createClient } from '@/lib/supabase/server';
import { searchNodes } from '@/lib/nodes/queries';
import { searchableTypes } from '@/lib/nodes/search';
import { formatDate } from '@/lib/format';
import Chip from '@/components/entity/Chips';
import EmptyState from '@/components/ui/EmptyState';

export const metadata = { title: 'Search · Adaca Red' };

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const query = (q ?? '').trim();

  const supabase = await createClient();
  // Same definitions-driven register list the dropdown uses — see
  // searchableTypes(). Neither surface may hardcode a type list.
  const groups = query
    ? await Promise.all(
        (await searchableTypes(supabase)).map(async (t) => ({
          ...t,
          rows: await searchNodes(supabase, t.key, query),
        })),
      )
    : [];
  const total = groups.reduce((n, g) => n + g.rows.length, 0);

  return (
    <div>
      <p className="eyebrow rv">Search</p>
      <h1 className="view-title rv" style={{ '--i': 1 } as CSSProperties}>
        Search
      </h1>
      <p className="lede rv" style={{ '--i': 2 } as CSSProperties}>
        Find anything in the register by title — every type that appears in the sidebar is searched.
      </p>

      <form action="/search" className="mt-8 flex gap-3">
        <input
          type="search"
          name="q"
          defaultValue={query}
          placeholder="Search titles…"
          className="field-input"
          style={{ maxWidth: 420 }}
          autoFocus
        />
        <button type="submit" className="btn btn-primary sm">Search</button>
      </form>

      {query && (
        <p className="mt-6 mono" style={{ fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--muted)' }}>
          {total} result{total === 1 ? '' : 's'} for &ldquo;{query}&rdquo;
        </p>
      )}

      {query && total === 0 && (
        <div className="mt-8">
          <EmptyState
            eyebrow="Search"
            title="No matches found"
            description={`Nothing matched “${query}”. Try a different term, or check spelling.`}
          />
        </div>
      )}

      {groups.map((g) =>
        g.rows.length === 0 ? null : (
          <section key={g.key} className="mt-10">
            <p className="field-label">{g.label}</p>
            <div className="queue" style={{ marginTop: 6 }}>
              {g.rows.map((row, i) => {
                const d = (row.data ?? {}) as { title?: string; status?: string };
                return (
                  <Link key={row.id} href={`${g.base}/${row.id}`} className="q">
                    <span className="qi">{String(i + 1).padStart(2, '0')}</span>
                    <span className="qt">
                      {d.title ?? 'Untitled'}
                      <small>Updated {formatDate(row.updated_at)}</small>
                    </span>
                    <span className="qm">{d.status && <Chip value={d.status} />}</span>
                  </Link>
                );
              })}
            </div>
          </section>
        ),
      )}
    </div>
  );
}
