import { createClient } from '@/lib/supabase/server';
import { getDefinition, fieldsOf } from '@/lib/definitions/server';
import { getChoices } from '@/lib/definitions/choices';
import { getSubtree } from '@/lib/nodes/queries';
import KanbanBoard from './KanbanBoard';

/**
 * Generic board loader: a Kanban of a node's `childType` descendants, grouped by
 * the `groupBy` enum field, with an optional container switcher over intermediate
 * `containerTypes`. The initiative→task board is just one configuration of this.
 */
export default async function Board({
  rootId,
  childType,
  groupBy,
  containerTypes = [],
  revalidatePath,
}: {
  rootId: string;
  childType: string;
  groupBy: string;
  containerTypes?: string[];
  revalidatePath: string;
}) {
  const supabase = await createClient();
  const [childDef, subtree] = await Promise.all([
    getDefinition(supabase, childType),
    getSubtree(supabase, rootId),
  ]);

  const groupField = childDef ? fieldsOf(childDef).find((f) => f.key === groupBy) : undefined;
  const columns = getChoices(groupField).map((c) => c.key);
  const fields = childDef ? fieldsOf(childDef) : [];

  const items = subtree
    .filter((n) => n.type_key === childType)
    .map((n) => {
      const d = (n.data ?? {}) as Record<string, unknown>;
      return {
        id: n.id,
        title: (d.title as string) ?? 'Untitled',
        group: (d[groupBy] as string) ?? '',
        parentId: n.parent_id ?? rootId,
        data: d,
      };
    });

  const containerNodes = subtree.filter((n) => containerTypes.includes(n.type_key));
  const containers = [
    { id: '__all__', label: 'All' },
    { id: rootId, label: 'Top level', dividerBefore: true },
    ...containerNodes.map((g, i) => ({
      id: g.id,
      label: ((g.data ?? {}) as { title?: string }).title ?? '—',
      dividerBefore: i === 0,
    })),
  ];

  return (
    <KanbanBoard
      rootId={rootId}
      childType={childType}
      typeLabel={childDef?.label ?? childType}
      groupBy={groupBy}
      containers={containers}
      items={items}
      columns={columns}
      fields={fields}
      revalidatePath={revalidatePath}
    />
  );
}
