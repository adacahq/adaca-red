import { createClient } from '@/lib/supabase/server';
import { listEdges, getNodesByIds, listNodes } from '@/lib/nodes/queries';
import MitigationManager from './MitigationManager';

/** Initiative side: the risks this initiative mitigates, each with RED. */
export default async function InitiativeMitigations({ initiativeId }: { initiativeId: string }) {
  const supabase = await createClient();
  const edges = await listEdges(supabase, initiativeId, { typeKey: 'mitigates', direction: 'from' });
  const riskIds = edges.map((e) => e.to_id);
  const [risks, allRisks] = await Promise.all([
    getNodesByIds(supabase, riskIds),
    listNodes(supabase, 'risk'),
  ]);
  const titleById = Object.fromEntries(
    risks.map((r) => [r.id, ((r.data ?? {}) as { title?: string }).title ?? 'Risk']),
  );
  const linked = new Set(riskIds);

  return (
    <MitigationManager
      initiativeId={initiativeId}
      revalidatePath={`/initiatives/${initiativeId}`}
      edges={edges.map((e) => ({
        id: e.id,
        riskId: e.to_id,
        riskTitle: titleById[e.to_id] ?? 'Risk',
        data: e.data,
      }))}
      riskOptions={allRisks
        .filter((r) => !linked.has(r.id))
        .map((r) => ({ id: r.id, title: ((r.data ?? {}) as { title?: string }).title ?? 'Risk' }))}
    />
  );
}
