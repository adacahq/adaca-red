import type { CSSProperties } from 'react';
import { createClient } from '@/lib/supabase/server';
import { listNodes } from '@/lib/nodes/queries';
import HeadlineMetrics from '@/components/canvas/HeadlineMetrics';
import SectionHeader from '@/components/canvas/SectionHeader';

export const metadata = { title: 'Incident analytics · Adaca Red' };

function Bars({ entries }: { entries: { label: string; count: number }[] }) {
  const max = Math.max(1, ...entries.map((e) => e.count));
  return (
    <div className="mt-4 flex flex-col gap-2.5">
      {entries.map((e) => (
        <div key={e.label} className="flex items-center gap-3">
          <span
            className="mono"
            style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--muted)', minWidth: 100 }}
          >
            {e.label.replace(/_/g, ' ')}
          </span>
          <span
            aria-hidden
            style={{ height: 12, width: `${(e.count / max) * 100}%`, minWidth: e.count ? 4 : 0, background: 'var(--series-3)' }}
          />
          <span className="mono" style={{ fontSize: 11, color: 'var(--fg)' }}>{e.count}</span>
        </div>
      ))}
    </div>
  );
}

export default async function Page() {
  const supabase = await createClient();
  const incs = await listNodes(supabase, 'incident');

  const bySev: Record<string, number> = {};
  const byStatus: Record<string, number> = {};
  let open = 0;
  for (const n of incs) {
    const d = (n.data ?? {}) as { severity?: string; status?: string };
    const sev = d.severity ?? '–';
    const st = d.status ?? '–';
    bySev[sev] = (bySev[sev] ?? 0) + 1;
    byStatus[st] = (byStatus[st] ?? 0) + 1;
    if (st && !['resolved', 'closed'].includes(st)) open++;
  }

  const sevOrder = ['sev1', 'sev2', 'sev3', 'sev4'];
  const sevEntries = sevOrder.map((s) => ({ label: s, count: bySev[s] ?? 0 }));
  const statusEntries = Object.entries(byStatus).map(([label, count]) => ({ label, count }));

  return (
    <div>
      <p className="eyebrow rv">Reports</p>
      <h1 className="view-title rv" style={{ '--i': 1 } as CSSProperties}>
        Incident analytics
      </h1>
      <p className="lede rv" style={{ '--i': 2 } as CSSProperties}>
        {incs.length} incident{incs.length === 1 ? '' : 's'} logged, {open} still open. Severity and status mix
        below.
      </p>

      <div className="rv" style={{ '--i': 3 } as CSSProperties}>
        <HeadlineMetrics
          metrics={[
            { label: 'Total', value: String(incs.length) },
            { label: 'Open', value: String(open) },
            { label: 'SEV1', value: String(bySev['sev1'] ?? 0) },
          ]}
        />
      </div>

      <SectionHeader title="Breakdowns" />

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 rv" style={{ '--i': 4 } as CSSProperties}>
        <div className="chart-card">
          <div className="chart-head">
            <p className="field-label" style={{ margin: 0 }}>By severity</p>
          </div>
          <Bars entries={sevEntries} />
        </div>
        <div className="chart-card">
          <div className="chart-head">
            <p className="field-label" style={{ margin: 0 }}>By status</p>
          </div>
          <Bars entries={statusEntries.length ? statusEntries : [{ label: '–', count: 0 }]} />
        </div>
      </div>
    </div>
  );
}
