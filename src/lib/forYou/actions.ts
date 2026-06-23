'use server';

import { createClient } from '@/lib/supabase/server';
import type { Json } from '@/lib/supabase/types';
import type { ForYouConfig } from './types';

/** The current user's saved For You config (empty ⇒ defaults: all columns/types). */
export async function loadForYouConfig(): Promise<ForYouConfig> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('for_you_views')
    .select('config')
    .eq('is_default', true)
    .maybeSingle();
  return (data?.config as ForYouConfig | undefined) ?? {};
}

/** Lazily upsert the caller's default For You config (mirrors saveDashboard). */
export async function saveForYouConfig(config: ForYouConfig): Promise<{ ok: boolean }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false };

  const { data: profile } = await supabase.from('users').select('id').eq('auth_id', user.id).single();
  if (!profile) return { ok: false };

  const { data: existing } = await supabase
    .from('for_you_views')
    .select('id')
    .eq('user_id', profile.id)
    .eq('is_default', true)
    .maybeSingle();

  if (existing) {
    const { error } = await supabase
      .from('for_you_views')
      .update({ config: config as unknown as Json })
      .eq('id', existing.id);
    return { ok: !error };
  }

  const { error } = await supabase
    .from('for_you_views')
    .insert({ user_id: profile.id, config: config as unknown as Json, is_default: true });
  return { ok: !error };
}
