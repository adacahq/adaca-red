import { createClient as createSupabaseClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from './types';

/**
 * Service-role Supabase client — SERVER ONLY, bypasses RLS.
 *
 * Used exclusively by (a) the public no-auth surface (form submission, run
 * pumping, report lookup — `anon` has zero grants by design) and (b) the purge
 * cron. Never import from client components; never hand the key to the
 * browser. The key comes from the SUPABASE_SERVICE_ROLE_KEY secret
 * (`wrangler secret put` in prod, .env in dev).
 */
export function createAdminClient(): SupabaseClient<Database> {
  if (typeof window !== 'undefined') {
    throw new Error('createAdminClient() must never run in the browser');
  }
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error('SUPABASE_SERVICE_ROLE_KEY is not set');
  return createSupabaseClient<Database>(import.meta.env.VITE_SUPABASE_URL, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
