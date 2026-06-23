import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  Database,
  NodeRow,
  EdgeRow,
  RevisionRow,
  UserRow,
} from '@/lib/supabase/types';

type DB = SupabaseClient<Database>;

export async function listNodes(
  db: DB,
  typeKey: string,
  filters: Record<string, string> = {},
): Promise<NodeRow[]> {
  let q = db.from('nodes').select('*').eq('type_key', typeKey).is('deleted_at', null);
  for (const [k, v] of Object.entries(filters)) {
    if (v) q = q.eq(`data->>${k}`, v);
  }
  const { data, error } = await q.order('updated_at', { ascending: false });
  if (error) throw error;
  return data;
}

export async function getNode(db: DB, id: string): Promise<NodeRow | null> {
  const { data, error } = await db.from('nodes').select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  return data;
}

export async function getNodesByIds(db: DB, ids: string[]): Promise<NodeRow[]> {
  if (ids.length === 0) return [];
  const { data, error } = await db.from('nodes').select('*').in('id', ids);
  if (error) throw error;
  return data;
}

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

/** A node plus its whole non-deleted subtree (via the get_subtree RPC). */
export async function getSubtree(db: DB, rootId: string): Promise<NodeRow[]> {
  const { data, error } = await db.rpc('get_subtree', { p_root: rootId });
  if (error) throw error;
  return data ?? [];
}

export async function listEdges(
  db: DB,
  nodeId: string,
  opts: { typeKey?: string; direction?: 'from' | 'to' | 'both' } = {},
): Promise<EdgeRow[]> {
  const { typeKey, direction = 'both' } = opts;
  let q = db.from('edges').select('*').is('deleted_at', null);
  if (direction === 'from') q = q.eq('from_id', nodeId);
  else if (direction === 'to') q = q.eq('to_id', nodeId);
  else q = q.or(`from_id.eq.${nodeId},to_id.eq.${nodeId}`);
  if (typeKey) q = q.eq('type_key', typeKey);
  const { data, error } = await q;
  if (error) throw error;
  return data;
}

export async function listRevisions(
  db: DB,
  targetKind: 'node' | 'edge',
  targetId: string,
): Promise<RevisionRow[]> {
  const { data, error } = await db
    .from('revisions')
    .select('*')
    .eq('target_kind', targetKind)
    .eq('target_id', targetId)
    .order('rev_no', { ascending: false });
  if (error) throw error;
  return data;
}

export async function listUsers(db: DB): Promise<UserRow[]> {
  const { data, error } = await db
    .from('users')
    .select('*')
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data;
}

export async function countNodes(db: DB, typeKey: string, filters: Record<string, string> = {}): Promise<number> {
  let q = db
    .from('nodes')
    .select('id', { count: 'exact', head: true })
    .eq('type_key', typeKey)
    .is('deleted_at', null);
  for (const [k, v] of Object.entries(filters)) if (v) q = q.eq(`data->>${k}`, v);
  const { count } = await q;
  return count ?? 0;
}

/** All non-deleted edges of a given type (e.g. every `mitigates` edge). */
export async function listEdgesByType(db: DB, typeKey: string): Promise<EdgeRow[]> {
  const { data, error } = await db
    .from('edges')
    .select('*')
    .eq('type_key', typeKey)
    .is('deleted_at', null);
  if (error) throw error;
  return data;
}

/** Title search across a node type (ilike on data->>title). */
export async function searchNodes(db: DB, typeKey: string, q: string): Promise<NodeRow[]> {
  const { data, error } = await db
    .from('nodes')
    .select('*')
    .eq('type_key', typeKey)
    .is('deleted_at', null)
    .ilike('data->>title', `%${q}%`)
    .limit(20);
  if (error) throw error;
  return data;
}
