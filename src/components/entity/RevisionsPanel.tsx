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
    return <p className="text-[13px]" style={{ color: 'var(--muted)' }}>No history yet.</p>;
  }

  return (
    <div className="feed">
      {revs.map((r) => (
        <div className="evt" key={r.id}>
          <span className="t">{formatDate(r.created_at)}</span>
          <span className="mono" style={{ fontSize: 10, color: 'var(--muted)' }}>
            r{r.rev_no}
          </span>{' '}
          <b>{nameById[r.author_id ?? ''] ?? 'Someone'}</b> {r.change_note ?? 'updated this record'}
        </div>
      ))}
    </div>
  );
}
