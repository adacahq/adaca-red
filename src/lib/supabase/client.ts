import { createBrowserClient } from '@supabase/ssr';
import type { Database } from './types';

/**
 * Browser Supabase client. Use in Client Components / browser code only.
 * Reads the public URL + anon (or publishable) key from Vite env — both are
 * safe to ship to the browser; RLS is what actually protects the data.
 */
export function createClient() {
  return createBrowserClient<Database>(
    import.meta.env.VITE_SUPABASE_URL,
    import.meta.env.VITE_SUPABASE_ANON_KEY,
  );
}
