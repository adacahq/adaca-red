import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { listNodes, listEdgesByType } from '@/lib/nodes/queries';
import { readRed, redTotal, type Red } from '@/lib/red';

export const metadata = { title: 'Portfolio · Adaca Red' };

export default async function Page() {
  const supabase = await createClient();
  const [inits, edges] = await Promise.all([
    listNodes(supabase, 'initiative'),
    listEdgesByType(supabase, 'mitigates'),
  ]);

  const byInit: Record<string, Red[]> = {};
  for (const e of edges) (byInit[e.from_id] ??= []).push(readRed(e.data));

  const rows = inits.map((i) => {
    const reds = byInit[i.id] ?? [];
    const avg = reds.length
      ? Math.round((reds.reduce((s, r) => s + redTotal(r), 0) / reds.length) * 10) / 10
      : 0;
    const d = (i.data ?? {}) as { title?: string; status?: string };
    return { id: i.id, title: d.title ?? 'Initiative', status: d.status ?? '–', covers: reds.length, avg };
  });

  return (
    <div className="">
      <h1 style={{ fontSize: 30, fontWeight: 500, letterSpacing: '-0.02em' }}>Portfolio</h1>
      <p className="mt-2 mb-6 text-[14px]" style={{ color: 'var(--muted)' }}>
        {inits.length} initiatives and their RED reach.
      </p>

      <table className="w-full text-[14px]" style={{ borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            {['Initiative', 'Status', 'Risks covered', 'Avg RED'].map((h) => (
              <th
                key={h}
                className="mono text-left"
                style={{ fontSize: 10, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--muted)', padding: '10px 14px', background: 'var(--bg-alt)', borderBottom: '1px solid var(--line)' }}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id}>
              <td style={{ padding: '12px 14px', borderBottom: '1px solid var(--line)' }}>
                <Link href={`/initiatives/${r.id}`} className="text-link" style={{ fontWeight: 500 }}>
                  {r.title}
                </Link>
              </td>
              <td className="mono" style={{ padding: '12px 14px', borderBottom: '1px solid var(--line)', fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase' }}>
                {r.status}
              </td>
              <td style={{ padding: '12px 14px', borderBottom: '1px solid var(--line)', color: 'var(--muted)' }}>
                {r.covers}
              </td>
              <td className="mono" style={{ padding: '12px 14px', borderBottom: '1px solid var(--line)', color: 'var(--ink)' }}>
                {r.avg}/12
              </td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td colSpan={4} style={{ padding: '24px 14px', color: 'var(--muted-2)' }}>
                No initiatives yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
