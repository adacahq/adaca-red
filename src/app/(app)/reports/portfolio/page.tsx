import type { CSSProperties } from 'react';
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
    <div>
      <p className="eyebrow rv">Reports</p>
      <h1 className="view-title rv" style={{ '--i': 1 } as CSSProperties}>
        Portfolio
      </h1>
      <p className="lede rv" style={{ '--i': 2 } as CSSProperties}>
        {inits.length} initiatives and the RED reach of each — how many risks it covers, and how strongly on
        average.
      </p>

      <div className="mt-10 rv" style={{ '--i': 3 } as CSSProperties}>
        <PortfolioTable rows={rows} />
      </div>
    </div>
  );
}
