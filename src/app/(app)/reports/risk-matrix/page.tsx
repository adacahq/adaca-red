import type { CSSProperties } from 'react';
import { createClient } from '@/lib/supabase/server';
import { listNodes } from '@/lib/nodes/queries';
import RiskMatrix from '@/components/reports/RiskMatrix';

export const metadata = { title: 'Risk matrix · Adaca Red' };

export default async function Page() {
  const supabase = await createClient();
  const risks = await listNodes(supabase, 'risk');

  const buckets: Record<string, { count: number; risks: { id: string; title: string }[] }> = {};
  for (const r of risks) {
    const d = (r.data ?? {}) as { likelihood?: number; impact?: number; title?: string };
    const l = Number(d.likelihood ?? 0);
    const i = Number(d.impact ?? 0);
    if (l >= 1 && l <= 5 && i >= 1 && i <= 5) {
      const k = `${l}-${i}`;
      (buckets[k] ??= { count: 0, risks: [] });
      buckets[k].count++;
      buckets[k].risks.push({ id: r.id, title: d.title ?? 'Untitled' });
    }
  }

  return (
    <div>
      <p className="eyebrow rv">Reports</p>
      <h1 className="view-title rv" style={{ '--i': 1 } as CSSProperties}>
        Risk matrix
      </h1>
      <p className="lede rv" style={{ '--i': 2 } as CSSProperties}>
        Inherent exposure — likelihood × impact — across {risks.length} risk{risks.length === 1 ? '' : 's'} in the
        register, before any mitigation is counted. Hover or focus a cell to see what&rsquo;s in it.
      </p>
      <div className="rv" style={{ '--i': 3 } as CSSProperties}>
        <RiskMatrix buckets={buckets} />
      </div>
    </div>
  );
}
