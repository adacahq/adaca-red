import Link from 'next/link';
import { MagnifyingGlassIcon } from '@heroicons/react/24/outline';
import { createClient } from '@/lib/supabase/server';
import { searchNodes } from '@/lib/nodes/queries';
import Chip from '@/components/entity/Chips';
import EmptyState from '@/components/ui/EmptyState';

export const metadata = { title: 'Search · Adaca Red' };

const TYPES = [
  { key: 'initiative', label: 'Initiatives', base: '/initiatives' },
  { key: 'risk', label: 'Risks', base: '/risks' },
  { key: 'incident', label: 'Incidents', base: '/incidents' },
];

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const query = (q ?? '').trim();

  const supabase = await createClient();
  const groups = query
    ? await Promise.all(
        TYPES.map(async (t) => ({ ...t, rows: await searchNodes(supabase, t.key, query) })),
      )
    : [];
  const total = groups.reduce((n, g) => n + g.rows.length, 0);

  return (
    <div className="">
      <h1 style={{ fontSize: 30, fontWeight: 500, letterSpacing: '-0.02em' }}>Search</h1>
      <form action="/search" className="mt-4 mb-8 flex gap-2">
        <input
          type="search"
          name="q"
          defaultValue={query}
          placeholder="Search titles…"
          className="field-input"
          style={{ maxWidth: 360 }}
          autoFocus
        />
        <button type="submit" className="btn btn-primary btn-sm">Search</button>
      </form>

      {query && (
        <p className="mb-4 text-[13px]" style={{ color: 'var(--muted)' }}>
          {total} result{total === 1 ? '' : 's'} for &ldquo;{query}&rdquo;
        </p>
      )}

      {query && total === 0 && (
        <EmptyState
          icon={MagnifyingGlassIcon}
          eyebrow="Search"
          title="No matches found"
          description={`Nothing matched “${query}”. Try a different term, or check spelling.`}
        />
      )}

      {groups.map((g) =>
        g.rows.length === 0 ? null : (
          <section key={g.key} className="mb-6">
            <p className="field-label">{g.label}</p>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, borderTop: '1px solid var(--line)' }}>
              {g.rows.map((row) => {
                const d = (row.data ?? {}) as { title?: string; status?: string };
                return (
                  <li key={row.id} className="flex items-center gap-3 py-2.5" style={{ borderBottom: '1px solid var(--line)' }}>
                    <Link href={`${g.base}/${row.id}`} className="text-link" style={{ flex: 1 }}>
                      {d.title ?? 'Untitled'}
                    </Link>
                    {d.status && <Chip value={d.status} />}
                  </li>
                );
              })}
            </ul>
          </section>
        ),
      )}
    </div>
  );
}
