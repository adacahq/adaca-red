'use server';

import { createClient } from '@/lib/supabase/server';
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

const TYPES: { key: string; label: string; base: string }[] = [
  { key: 'initiative', label: 'Initiatives', base: '/initiatives' },
  { key: 'risk', label: 'Risks', base: '/risks' },
  { key: 'incident', label: 'Incidents', base: '/incidents' },
];

/** Indexed search across the three node types, grouped for the dropdown. */
export async function searchAll(q: string): Promise<SearchGroup[]> {
  const query = q.trim();
  if (!query) return [];

  const supabase = await createClient();
  const groups = await Promise.all(
    TYPES.map(async (t) => {
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
