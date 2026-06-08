import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, DefinitionRow, NodeRow, EdgeRow } from './types';

type DB = SupabaseClient<Database>;

/** All node + edge type definitions (drives forms, filters, validation). */
export async function listDefinitions(db: DB): Promise<DefinitionRow[]> {
  const { data, error } = await db.from('definitions').select('*');
  if (error) throw error;
  return data;
}

/** Live (non-deleted) nodes of one type, ordered for display. */
export async function listNodesByType(db: DB, typeKey: string): Promise<NodeRow[]> {
  const { data, error } = await db
    .from('nodes')
    .select('*')
    .eq('type_key', typeKey)
    .is('deleted_at', null)
    .order('position', { ascending: true });
  if (error) throw error;
  return data;
}

/** Direct children of a node (one level of the containment tree). */
export async function listChildren(db: DB, parentId: string): Promise<NodeRow[]> {
  const { data, error } = await db
    .from('nodes')
    .select('*')
    .eq('parent_id', parentId)
    .is('deleted_at', null)
    .order('position', { ascending: true });
  if (error) throw error;
  return data;
}

/** Edges of a given type touching a node (either direction). */
export async function listEdgesForNode(
  db: DB,
  nodeId: string,
  typeKey?: string,
): Promise<EdgeRow[]> {
  let q = db
    .from('edges')
    .select('*')
    .or(`from_id.eq.${nodeId},to_id.eq.${nodeId}`)
    .is('deleted_at', null);
  if (typeKey) q = q.eq('type_key', typeKey);
  const { data, error } = await q;
  if (error) throw error;
  return data;
}
