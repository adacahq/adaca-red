import { createClient } from '@/lib/supabase/server';
import { getDefinition, fieldsOf } from '@/lib/definitions/server';
import { loadDashboard } from '@/lib/dashboard/actions';
import type { Source, SourceMeta } from '@/lib/dashboard/types';
import DashboardGrid from '@/components/dashboard/DashboardGrid';

export default async function Dashboard() {
  const supabase = await createClient();
  const [layout, dInitiative, dRisk, dIncident] = await Promise.all([
    loadDashboard(),
    getDefinition(supabase, 'initiative'),
    getDefinition(supabase, 'risk'),
    getDefinition(supabase, 'incident'),
  ]);

  const defs: Record<Source, typeof dRisk> = { initiative: dInitiative, risk: dRisk, incident: dIncident };
  const labels: Record<Source, string> = { initiative: 'Initiative', risk: 'Risk', incident: 'Incident' };
  const sources: SourceMeta[] = (['initiative', 'risk', 'incident'] as Source[]).map((key) => ({
    key,
    label: defs[key]?.label ?? labels[key],
    fields: defs[key] ? fieldsOf(defs[key]!) : [],
  }));

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
