import type { CSSProperties } from 'react';
import { createClient } from '@/lib/supabase/server';
import { loadDefinitions, fieldsOf } from '@/lib/definitions/server';
import { loadDashboard } from '@/lib/dashboard/actions';
import type { SourceMeta } from '@/lib/dashboard/types';
import DashboardGrid from '@/components/dashboard/DashboardGrid';

// Display order for the source picker; the primary domain types lead, every
// other node type follows alphabetically. Ordering only — nothing is excluded,
// so a new node type shows up as a dashboard source automatically.
const SOURCE_ORDER = ['initiative', 'risk', 'incident', 'task', 'milestone', 'dependency', 'status_report'];

export default async function Dashboard() {
  const supabase = await createClient();
  const [layout, defs] = await Promise.all([loadDashboard(), loadDefinitions(supabase)]);

  const rank = (k: string) => {
    const i = SOURCE_ORDER.indexOf(k);
    return i === -1 ? SOURCE_ORDER.length : i;
  };
  const sources: SourceMeta[] = Object.values(defs)
    .filter((d) => d.kind === 'node')
    .sort((a, b) => rank(a.key) - rank(b.key) || a.label.localeCompare(b.label))
    .map((d) => ({ key: d.key, label: d.label, fields: fieldsOf(d) }));

  return (
    <div>
      <p className="eyebrow rv">Dashboard</p>
      <h1 className="view-title rv" style={{ '--i': 1 } as CSSProperties}>
        Dashboard
      </h1>
      <p className="lede rv" style={{ '--i': 2 } as CSSProperties}>
        Build your own view onto the register — KPIs, charts and tables assembled live from initiatives, risks and incidents.
      </p>

      <div className="mt-10">
        <DashboardGrid initialLayout={layout} sources={sources} />
      </div>
    </div>
  );
}
