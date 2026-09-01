'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import type { Json, RetentionSetting } from '@/lib/supabase/types';
import { RETENTION_KEYS } from './retention';

/** Admin-only (RLS `settings: write` policy) update of the retention clocks. */
export async function updateRetention(input: {
  submission: RetentionSetting;
  assessment: RetentionSetting;
}): Promise<void> {
  const supabase = await createClient();
  for (const [key, value] of [
    [RETENTION_KEYS.submission, input.submission],
    [RETENTION_KEYS.assessment, input.assessment],
  ] as const) {
    const { error } = await supabase
      .from('settings')
      .upsert({ key, value: value as unknown as Json }, { onConflict: 'key' });
    if (error) throw error;
  }
  revalidatePath('/admin/settings');
}
