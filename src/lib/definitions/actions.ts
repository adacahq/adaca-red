'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import type { DefinitionKind, Json } from '@/lib/supabase/types';

/** Admin-only (enforced by RLS is_admin policy) edits to the type registry. */

export async function saveDefinition(input: { id: string; label: string; config: Json; revalidate?: string }) {
  const supabase = await createClient();
  const { error } = await supabase
    .from('definitions')
    .update({ label: input.label, config: input.config })
    .eq('id', input.id);
  if (error) throw error;
  revalidatePath(input.revalidate ?? '/admin/definitions');
}

export async function createDefinition(input: {
  kind: DefinitionKind;
  key: string;
  label: string;
  config: Json;
  revalidate?: string;
}) {
  const supabase = await createClient();
  const { error } = await supabase.from('definitions').insert({
    kind: input.kind,
    key: input.key,
    label: input.label,
    config: input.config,
  });
  if (error) throw error;
  revalidatePath(input.revalidate ?? '/admin/definitions');
}

export async function deleteDefinition(id: string, revalidate?: string) {
  const supabase = await createClient();
  const { error } = await supabase.from('definitions').delete().eq('id', id);
  if (error) throw error;
  revalidatePath(revalidate ?? '/admin/definitions');
}
