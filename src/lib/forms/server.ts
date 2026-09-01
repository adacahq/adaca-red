import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, DefinitionRow, FormConfig, NodeConfig } from '@/lib/supabase/types';

type DB = SupabaseClient<Database>;

export interface LoadedForm {
  def: DefinitionRow;
  config: FormConfig;
  target: DefinitionRow;
  targetConfig: NodeConfig;
}

/** Load an enabled public form + its target node type. Null = 404. */
export async function loadForm(db: DB, formKey: string): Promise<LoadedForm | null> {
  const { data: def, error } = await db
    .from('definitions')
    .select('*')
    .eq('kind', 'form')
    .eq('key', formKey)
    .maybeSingle();
  if (error) throw error;
  if (!def) return null;
  const config = (def.config ?? {}) as unknown as FormConfig;
  if (!config.enabled || !config.targetType) return null;

  const { data: target, error: tErr } = await db
    .from('definitions')
    .select('*')
    .eq('kind', 'node')
    .eq('key', config.targetType)
    .maybeSingle();
  if (tErr) throw tErr;
  if (!target) return null;

  return {
    def,
    config,
    target,
    targetConfig: (target.config ?? {}) as unknown as NodeConfig,
  };
}
