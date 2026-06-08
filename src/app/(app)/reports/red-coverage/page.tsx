import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { listNodes, listEdgesByType } from '@/lib/nodes/queries';
import { readRed, coverageFromReds, type Red } from '@/lib/red';

export const metadata = { title: 'RED coverage · Adaca Red' };

export default async function Page() {
  const supabase = await createClient();
  const [risks, edges] = await Promise.all([
    listNodes(supabase, 'risk'),
    listEdgesByType(supabase, 'mitigates'),
  ]);

  const byRisk: Record<string, Red[]> = {};
  for (const e of edges) (byRisk[e.to_id] ??= []).push(readRed(e.data));

  const rows = risks
    .map((r) => {
      const reds = byRisk[r.id] ?? [];
      return {
        id: r.id,
        title: ((r.data ?? {}) as { title?: string }).title ?? 'Risk',
        count: reds.length,
        coverage: Math.round(coverageFromReds(reds) * 100),
      };
    })
    .sort((a, b) => a.coverage - b.coverage);

  const unmitigated = rows.filter((r) => r.count === 0);

  return (
    <div className="">
      <h1 style={{ fontSize: 30, fontWeight: 500, letterSpacing: '-0.02em' }}>RED coverage</h1>
      <p className="mt-2 mb-6 text-[14px]" style={{ color: 'var(--muted)' }}>
        {unmitigated.length} of {rows.length} risks have no mitigating initiative.
      </p>

      <table className="w-full text-[14px]" style={{ borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            {['Risk', 'Mitigations', 'Coverage'].map((h) => (
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
                <Link href={`/risks/${r.id}`} className="text-link" style={{ fontWeight: 500 }}>
                  {r.title}
                </Link>
              </td>
              <td style={{ padding: '12px 14px', borderBottom: '1px solid var(--line)', color: 'var(--muted)' }}>
                {r.count}
              </td>
              <td style={{ padding: '12px 14px', borderBottom: '1px solid var(--line)' }}>
                <span
                  className="mono"
                  style={{ fontSize: 12, color: r.coverage < 33 ? 'var(--red-ink)' : r.coverage < 66 ? 'var(--amber-ink)' : 'var(--green-ink)' }}
                >
                  {r.coverage}%
                </span>
              </td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td colSpan={3} style={{ padding: '24px 14px', color: 'var(--muted-2)' }}>
                No risks yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
