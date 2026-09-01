'use server';

import { createClient } from '@/lib/supabase/server';
import { loadDefinitions } from '@/lib/definitions/server';
import { pluralize } from '@/lib/text';
import { routeFor } from './routes';
import { searchNodes } from './queries';

export interface SearchHit {
  id: string;
  title: string;
  status?: string;
}

export interface SearchGroup {
  key: string;
  label: string;
  base: string;
  rows: SearchHit[];
}

/**
 * The searchable registers, derived from the definitions registry rather than
 * hardcoded. A hardcoded trio silently excluded every node type added since —
 * assessments, submissions and tasks were all unsearchable while sitting in
 * the sidebar. Adding a node type is a definition row; it must not also
 * require editing search.
 */
export async function searchableTypes(
  db: Awaited<ReturnType<typeof createClient>>,
): Promise<{ key: string; label: string; base: string }[]> {
  const defs = await loadDefinitions(db);
  return Object.values(defs)
    .filter((d) => d.kind === 'node')
    .map((d) => ({ key: d.key, label: pluralize(d.label), base: routeFor(d.key) }))
    .sort((a, b) => a.label.localeCompare(b.label));
}

/** Indexed search across the three node types, grouped for the dropdown. */
export async function searchAll(q: string): Promise<SearchGroup[]> {
  const query = q.trim();
  if (!query) return [];

  const supabase = await createClient();
  const types = await searchableTypes(supabase);
  const groups = await Promise.all(
    types.map(async (t) => {
      const rows = await searchNodes(supabase, t.key, query);
      return {
        ...t,
        rows: rows.slice(0, 6).map((r) => {
          const d = (r.data ?? {}) as { title?: string; status?: string };
          return { id: r.id, title: d.title ?? 'Untitled', status: d.status };
        }),
      };
    }),
  );
  return groups.filter((g) => g.rows.length > 0);
}
