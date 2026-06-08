import { createClient } from '@/lib/supabase/server';
import { listEdges, getNodesByIds, listNodes } from '@/lib/nodes/queries';
import EdgeLinker from './EdgeLinker';

/** Server wrapper for managing a plain (unscored) edge type on a node. */
export default async function PlainEdges({
  nodeId,
  edgeType,
  direction,
  targetType,
  targetBasePath,
  revalidatePath,
  addLabel,
}: {
  nodeId: string;
  edgeType: string;
  direction: 'from' | 'to';
  targetType: string;
  targetBasePath: string;
  revalidatePath: string;
  addLabel?: string;
}) {
  const supabase = await createClient();
  const edges = await listEdges(supabase, nodeId, { typeKey: edgeType, direction });
  const targetIds = edges.map((e) => (direction === 'from' ? e.to_id : e.from_id));
  const [targets, all] = await Promise.all([
    getNodesByIds(supabase, targetIds),
    listNodes(supabase, targetType),
  ]);
  const titleById = Object.fromEntries(
    targets.map((t) => [t.id, ((t.data ?? {}) as { title?: string }).title ?? '–']),
  );
  const linkedSet = new Set(targetIds);

  return (
    <EdgeLinker
      nodeId={nodeId}
      edgeType={edgeType}
      direction={direction}
      targetBasePath={targetBasePath}
      revalidatePath={revalidatePath}
      addLabel={addLabel}
      linked={edges.map((e) => {
        const tid = direction === 'from' ? e.to_id : e.from_id;
        return { edgeId: e.id, targetId: tid, targetTitle: titleById[tid] ?? '–' };
      })}
      options={all
        .filter((t) => !linkedSet.has(t.id))
        .map((t) => ({ id: t.id, title: ((t.data ?? {}) as { title?: string }).title ?? '–' }))}
    />
  );
}
