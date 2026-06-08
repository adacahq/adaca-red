import { createClient } from '@/lib/supabase/server';
import { loadDefinitions, fieldsOf } from '@/lib/definitions/server';
import { getChoices } from '@/lib/definitions/choices';
import { getSubtree } from '@/lib/nodes/queries';
import type { FieldDef } from '@/lib/supabase/types';
import Tree, { type ChildType } from './Tree';

/**
 * Server wrapper: loads a node's subtree + derives which child types may be
 * added under each node type (inverting `allowedParents`), then renders the
 * client Tree.
 */
export default async function ContainmentTree({
  rootId,
  revalidatePath,
  onlyTypes,
}: {
  rootId: string;
  revalidatePath: string;
  /** Restrict the tree to these child types (the root node is always kept). */
  onlyTypes?: string[];
}) {
  const supabase = await createClient();
  const [defs, subtree] = await Promise.all([
    loadDefinitions(supabase),
    getSubtree(supabase, rootId),
  ]);
  const nodes = onlyTypes
    ? subtree.filter((n) => n.id === rootId || onlyTypes.includes(n.type_key))
    : subtree;

  const typeLabels: Record<string, string> = {};
  const fieldsByType: Record<string, FieldDef[]> = {};
  const childTypesByParent: Record<string, ChildType[]> = {};

  for (const def of Object.values(defs)) {
    if (def.kind !== 'node') continue;
    typeLabels[def.key] = def.label;
    fieldsByType[def.key] = fieldsOf(def);
    if (onlyTypes && !onlyTypes.includes(def.key)) continue;
    const allowedParents = ((def.config ?? {}) as { allowedParents?: string[] }).allowedParents ?? [];
    const statusField = fieldsOf(def).find((f) => f.key === 'status');
    const defaults: Record<string, unknown> = {};
    const firstStatus = getChoices(statusField)[0]?.key;
    if (firstStatus) defaults.status = firstStatus;
    for (const parent of allowedParents) {
      (childTypesByParent[parent] ??= []).push({ key: def.key, label: def.label, defaults });
    }
  }

  return (
    <Tree
      rootId={rootId}
      nodes={nodes}
      typeLabels={typeLabels}
      fieldsByType={fieldsByType}
      childTypesByParent={childTypesByParent}
      revalidatePath={revalidatePath}
    />
  );
}
