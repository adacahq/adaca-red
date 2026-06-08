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
    <div className="">
      <h1 style={{ fontSize: 30, fontWeight: 500, letterSpacing: '-0.02em' }}>Risk matrix</h1>
      <p className="mt-2 text-[14px]" style={{ color: 'var(--muted)' }}>
        Inherent exposure (likelihood × impact). {risks.length} risks plotted. Hover a cell to see its risks.
      </p>
      <RiskMatrix buckets={buckets} />
    </div>
  );
}
