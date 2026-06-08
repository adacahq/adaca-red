'use server';

import { createClient } from '@/lib/supabase/server';
import { listNodes } from './queries';

export interface ExportRow {
  id: string;
  created_at: string;
  updated_at: string;
  data: Record<string, unknown>;
}

/** Every non-deleted node of a type, for client-side export (selection,
 *  ordering, filtering and CSV/XLSX generation all happen in the browser). */
export async function fetchExportRows(typeKey: string): Promise<ExportRow[]> {
  const supabase = await createClient();
  const rows = await listNodes(supabase, typeKey);
  return rows.map((r) => ({
    id: r.id,
    created_at: r.created_at,
    updated_at: r.updated_at,
    data: (r.data ?? {}) as Record<string, unknown>,
  }));
}
