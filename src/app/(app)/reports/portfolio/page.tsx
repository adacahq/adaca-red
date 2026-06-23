import { createClient } from '@/lib/supabase/server';
import { listNodes, listEdgesByType } from '@/lib/nodes/queries';
import { readRed, redTotal, type Red } from '@/lib/red';
import PortfolioTable from './PortfolioTable';

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

      <PortfolioTable rows={rows} />
    </div>
  );
}
