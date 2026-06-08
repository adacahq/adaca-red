'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

/**
 * Assign (or clear) a user's system role. Authorisation is enforced in the
 * database: the `set_user_role` RPC checks the caller is an admin/owner and
 * validates the role, so this is safe even though it's reachable from the client.
 */
export async function setUserRole(userId: string, role: string | null) {
  const supabase = await createClient();
  const { error } = await supabase.rpc('set_user_role', {
    target_user_id: userId,
    new_role: role,
  });
  if (error) throw error;
  revalidatePath('/admin/users');
}
