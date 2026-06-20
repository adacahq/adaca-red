'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import type { Json } from '@/lib/supabase/types';

type NodeInput = {
  id?: string | null;
  type: string;
  parent?: string | null;
  data: Record<string, unknown>;
  position?: number;
  changeNote?: string;
  revalidate?: string;
};

export async function saveNode(input: NodeInput): Promise<string> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('save_node', {
    p_id: input.id ?? null,
    p_type: input.type,
    p_parent: input.parent ?? null,
    p_data: input.data as Json,
    // null → RPC preserves existing position on update (and defaults to 0 on
    // create). Passing 0 here would reset a node to the top on every edit.
    p_position: input.position ?? null,
    p_change_note: input.changeNote ?? null,
  });
  if (error) throw error;
  if (input.revalidate) revalidatePath(input.revalidate);
  return data as unknown as string;
}

export async function deleteNode(id: string, revalidate?: string): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.rpc('soft_delete_node', { p_id: id });
  if (error) throw error;
  if (revalidate) revalidatePath(revalidate);
}

/**
 * Persist a manual ordering: sets `nodes.position` to each id's index in the
 * given list. A direct column update (no revision noise) — RLS still gates it
 * via the nodes write policy. This is what drag-to-reorder writes, and what the
 * containment tree / board both read back via `position`.
 */
export async function reorderNodes(orderedIds: string[], revalidate?: string): Promise<void> {
  if (orderedIds.length === 0) return;
  const supabase = await createClient();
  const results = await Promise.all(
    orderedIds.map((id, i) => supabase.from('nodes').update({ position: i }).eq('id', id)),
  );
  const failed = results.find((r) => r.error);
  if (failed?.error) throw failed.error;
  if (revalidate) revalidatePath(revalidate);
}

type EdgeInput = {
  id?: string | null;
  type: string;
  from: string;
  to: string;
  data?: Record<string, unknown>;
  changeNote?: string;
  revalidate?: string;
};

export async function saveEdge(input: EdgeInput): Promise<string> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('save_edge', {
    p_id: input.id ?? null,
    p_type: input.type,
    p_from: input.from,
    p_to: input.to,
    p_data: (input.data ?? {}) as Json,
    p_change_note: input.changeNote ?? null,
  });
  if (error) throw error;
  if (input.revalidate) revalidatePath(input.revalidate);
  return data as unknown as string;
}

export async function deleteEdge(id: string, revalidate?: string): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.rpc('soft_delete_edge', { p_id: id });
  if (error) throw error;
  if (revalidate) revalidatePath(revalidate);
}

export async function assignUser(
  nodeId: string,
  userId: string,
  roleKey: string,
  revalidate?: string,
): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase
    .from('assignments')
    .insert({ node_id: nodeId, user_id: userId, role_key: roleKey });
  if (error) throw error;
  if (revalidate) revalidatePath(revalidate);
}

export async function unassignUser(assignmentId: string, revalidate?: string): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.from('assignments').delete().eq('id', assignmentId);
  if (error) throw error;
  if (revalidate) revalidatePath(revalidate);
}
