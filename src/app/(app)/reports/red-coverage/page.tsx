import { createClient } from '@/lib/supabase/server';
import { listNodes, listEdgesByType } from '@/lib/nodes/queries';
import { readRed, coverageFromReds, type Red } from '@/lib/red';
import CoverageTable from './CoverageTable';

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

      <CoverageTable rows={rows} />
    </div>
  );
}
