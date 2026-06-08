'use server';

import { createClient } from '@/lib/supabase/server';
import type { Json } from '@/lib/supabase/types';
import type { WidgetInstance } from './types';

/** The caller's default dashboard layout ([] if none yet). RLS scopes to owner. */
export async function loadDashboard(): Promise<WidgetInstance[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('dashboards')
    .select('layout')
    .eq('is_default', true)
    .maybeSingle();
  return (data?.layout as WidgetInstance[] | undefined) ?? [];
}

/** Upsert the caller's default dashboard layout (creates the row on first save). */
export async function saveDashboard(layout: WidgetInstance[]): Promise<{ ok: boolean }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false };

  const { data: profile } = await supabase.from('users').select('id').eq('auth_id', user.id).single();
  if (!profile) return { ok: false };

  const { data: existing } = await supabase
    .from('dashboards')
    .select('id')
    .eq('user_id', profile.id)
    .eq('is_default', true)
    .maybeSingle();

  if (existing) {
    const { error } = await supabase
      .from('dashboards')
      .update({ layout: layout as unknown as Json })
      .eq('id', existing.id);
    return { ok: !error };
  }

  const { error } = await supabase
    .from('dashboards')
    .insert({ user_id: profile.id, layout: layout as unknown as Json, is_default: true });
  return { ok: !error };
}
