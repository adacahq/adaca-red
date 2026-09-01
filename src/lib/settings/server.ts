import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, RetentionSetting } from '@/lib/supabase/types';
import { DEFAULT_RETENTION, RETENTION_KEYS } from './retention';

type DB = SupabaseClient<Database>;

/** Read one settings row's value (whole jsonb), or null when absent. */
export async function getSetting<T>(db: DB, key: string): Promise<T | null> {
  const { data, error } = await db.from('settings').select('value').eq('key', key).maybeSingle();
  if (error) throw error;
  return (data?.value as T) ?? null;
}

export async function setSetting(db: DB, key: string, value: unknown): Promise<void> {
  const { error } = await db
    .from('settings')
    .upsert({ key, value: value as Database['public']['Tables']['settings']['Insert']['value'] }, { onConflict: 'key' });
  if (error) throw error;
}

/** Both retention clocks, falling back to the shipped defaults. */
export async function loadRetentionSettings(db: DB): Promise<{
  submission: RetentionSetting;
  assessment: RetentionSetting;
}> {
  const { data, error } = await db
    .from('settings')
    .select('key, value')
    .in('key', [RETENTION_KEYS.submission, RETENTION_KEYS.assessment]);
  if (error) throw error;
  const map = new Map((data ?? []).map((r) => [r.key, r.value as unknown as RetentionSetting]));
  return {
    submission: map.get(RETENTION_KEYS.submission) ?? DEFAULT_RETENTION.submission,
    assessment: map.get(RETENTION_KEYS.assessment) ?? DEFAULT_RETENTION.assessment,
  };
}
