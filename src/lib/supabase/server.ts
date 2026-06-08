import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import type { Database } from './types';

/**
 * Server Supabase client (Server Components, Route Handlers, Server Actions).
 * Uses the current request's cookies via the @supabase/ssr getAll/setAll API.
 *
 * Note: writing cookies from a Server Component throws — that's expected and
 * swallowed here; session refresh is the job of middleware (see CLAUDE.md).
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    import.meta.env.VITE_SUPABASE_URL,
    import.meta.env.VITE_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // Called from a Server Component — safe to ignore when middleware
            // is refreshing the session.
          }
        },
      },
    },
  );
}
