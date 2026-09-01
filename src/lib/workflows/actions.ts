'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { advanceRun, retryRun } from './runner';

const MAX_UNITS = 40;

/**
 * Admin "Retry" for a failed run: clears the failure and pumps the workflow
 * to completion in-place (units are idempotent; the failed step's partial
 * output is overwritten). Execution needs the service-role client (Storage
 * downloads + documents writes have no authenticated policies), so the caller
 * is explicitly verified as admin/owner first.
 */
export async function retryAndPump(submissionId: string): Promise<{ status: string; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Not signed in');
  const { data: me } = await supabase.from('users').select('role').eq('auth_id', user.id).single();
  if (!me || !(me.role === 'admin' || me.role === 'owner')) throw new Error('Not authorized');

  const db = createAdminClient();
  const origin = process.env.PUBLIC_ORIGIN ?? 'http://localhost:3000';

  let progress = await retryRun(db, submissionId);
  if (!progress) return { status: 'missing' };

  for (let i = 0; i < MAX_UNITS; i++) {
    if (progress.status === 'done' || progress.status === 'failed') break;
    progress = (await advanceRun(db, submissionId, origin)) ?? progress;
  }

  revalidatePath('/admin/workflows');
  return { status: progress.status, error: progress.error };
}
