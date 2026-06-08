'use server';

import { saveNode } from './actions';

/**
 * Bindable create/update action for EntityForm. The page binds `meta`
 * (type/id/parent) and passes the result; the client form supplies `data`.
 */
export async function submitNode(
  meta: { type: string; id?: string | null; parent?: string | null; revalidate?: string },
  data: Record<string, unknown>,
): Promise<string> {
  return saveNode({
    id: meta.id ?? null,
    type: meta.type,
    parent: meta.parent ?? null,
    data,
    revalidate: meta.revalidate,
  });
}
