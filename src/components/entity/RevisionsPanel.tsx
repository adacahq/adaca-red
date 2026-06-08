import { createClient } from '@/lib/supabase/server';
import { listRevisions, listUsers } from '@/lib/nodes/queries';
import { formatDate } from '@/lib/format';

/** Append-only revision history for a node or edge. */
export default async function RevisionsPanel({
  kind,
  id,
}: {
  kind: 'node' | 'edge';
  id: string;
}) {
  const supabase = await createClient();
  const [revs, users] = await Promise.all([
    listRevisions(supabase, kind, id),
    listUsers(supabase),
  ]);
  const nameById = Object.fromEntries(users.map((u) => [u.id, u.name ?? u.email ?? '–']));

  if (revs.length === 0) {
    return <p className="text-[13px]" style={{ color: 'var(--muted-2)' }}>No history yet.</p>;
  }

  return (
    <ul style={{ listStyle: 'none', padding: 0, margin: 0, borderTop: '1px solid var(--line)' }}>
      {revs.map((r) => (
        <li
          key={r.id}
          className="flex items-baseline gap-4 py-3"
          style={{ borderBottom: '1px solid var(--line)' }}
        >
          <span className="mono" style={{ fontSize: 10, color: 'var(--muted-2)', minWidth: 40 }}>
            r{r.rev_no}
          </span>
          <span style={{ fontSize: 13, color: 'var(--ink)', flex: 1 }}>
            {r.change_note ?? 'Updated'}
          </span>
          <span style={{ fontSize: 12, color: 'var(--muted)' }}>
            {nameById[r.author_id ?? ''] ?? '–'} · {formatDate(r.created_at)}
          </span>
        </li>
      ))}
    </ul>
  );
}
