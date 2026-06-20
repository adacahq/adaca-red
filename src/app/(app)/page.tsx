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
      <div className="mb-2 flex items-center gap-3">
        <span
          className="mono"
          style={{ fontSize: 10, letterSpacing: '0.12em', color: 'var(--muted-2)', textTransform: 'uppercase' }}
        >
          Operations
        </span>
        <span className="divider" style={{ flex: 1 }} aria-hidden />
      </div>

      <h1 style={{ fontSize: 32, fontWeight: 500, letterSpacing: '-0.02em', lineHeight: 1.2 }}>Dashboard</h1>

      <DashboardGrid initialLayout={layout} sources={sources} />
    </div>
  );
}
