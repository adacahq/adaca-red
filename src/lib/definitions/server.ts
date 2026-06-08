import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  Database,
  DefinitionRow,
  EdgeConfig,
  FieldDef,
  NodeConfig,
} from '@/lib/supabase/types';
import { getChoices, type ChoiceMeta } from './choices';

type DB = SupabaseClient<Database>;

export async function loadDefinitions(db: DB): Promise<Record<string, DefinitionRow>> {
  const { data, error } = await db.from('definitions').select('*');
  if (error) throw error;
  const map: Record<string, DefinitionRow> = {};
  for (const d of data) map[d.key] = d;
  return map;
}

export async function getDefinition(db: DB, key: string): Promise<DefinitionRow | null> {
  const { data, error } = await db
    .from('definitions')
    .select('*')
    .eq('key', key)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export function fieldsOf(def: DefinitionRow): FieldDef[] {
  return ((def.config ?? {}) as { fields?: FieldDef[] }).fields ?? [];
}

/**
 * Flat key → {label, tone} map across every enum field in every definition.
 * Feeds the Chip context so status/severity/priority pills get their label and
 * colour from data, not a hardcoded map.
 */
export async function loadChoiceMeta(db: DB): Promise<ChoiceMeta> {
  const defs = await loadDefinitions(db);
  const map: ChoiceMeta = {};
  for (const def of Object.values(defs)) {
    for (const f of fieldsOf(def)) {
      if (f.data_type === 'enum') {
        for (const c of getChoices(f)) map[c.key] = { label: c.label, tone: c.tone };
      }
    }
  }
  return map;
}

export function nodeConfig(def: DefinitionRow): NodeConfig {
  return (def.config ?? {}) as unknown as NodeConfig;
}

export function edgeConfig(def: DefinitionRow): EdgeConfig {
  return (def.config ?? {}) as unknown as EdgeConfig;
}

/** Fields flagged filterable, in display order. */
export function filterableFields(def: DefinitionRow): FieldDef[] {
  return fieldsOf(def)
    .filter((f) => f.filterable)
    .sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
}
