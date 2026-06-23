import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, DefinitionRow } from '@/lib/supabase/types';
import { fieldsOf } from '@/lib/definitions/server';
import { listNodes } from '@/lib/nodes/queries';
import type { ForYouItem } from './types';

type DB = SupabaseClient<Database>;

/** For each node type, the keys of its `user`/`users` fields flagged "For You". */
export function forYouFieldsByType(defs: Record<string, DefinitionRow>): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const def of Object.values(defs)) {
    if (def.kind !== 'node') continue;
    const keys = fieldsOf(def)
      .filter((f) => (f.data_type === 'user' || f.data_type === 'users') && f.forYou)
      .map((f) => f.key);
    if (keys.length) out[def.key] = keys;
  }
  return out;
}

/**
 * Every node where the current user is the value of a For-You-flagged field —
 * across all node types. Single `user` fields match on equality, multi `users`
 * fields match on membership. Fetch-then-filter in JS (simple + correct); can be
 * pushed into SQL later if volume warrants.
 */
export async function forYouItems(
  db: DB,
  userId: string,
  defs: Record<string, DefinitionRow>,
): Promise<ForYouItem[]> {
  const byType = forYouFieldsByType(defs);
  const items: ForYouItem[] = [];
  for (const [typeKey, fields] of Object.entries(byType)) {
    const nodes = await listNodes(db, typeKey);
    for (const n of nodes) {
      const data = (n.data ?? {}) as Record<string, unknown>;
      const mine = fields.some((k) => {
        const v = data[k];
        return Array.isArray(v) ? v.includes(userId) : v === userId;
      });
      if (mine) items.push({ id: n.id, typeKey, data });
    }
  }
  return items;
}
