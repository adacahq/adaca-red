import { createClient } from '@/lib/supabase/server';
import { listChildren } from '@/lib/nodes/queries';
import TimelineEditor from './TimelineEditor';

/** Server wrapper: loads an incident's `incident_update` children. */
export default async function IncidentTimeline({ incidentId }: { incidentId: string }) {
  const supabase = await createClient();
  const children = await listChildren(supabase, incidentId);
  const entries = children
    .filter((n) => n.type_key === 'incident_update')
    .map((n) => {
      const d = (n.data ?? {}) as { at?: string; note?: string };
      return { id: n.id, at: d.at ?? null, note: d.note ?? null };
    });

  return (
    <TimelineEditor incidentId={incidentId} entries={entries} revalidatePath={`/incidents/${incidentId}`} />
  );
}
