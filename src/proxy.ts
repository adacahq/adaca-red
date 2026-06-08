import { type NextRequest } from 'next/server';
import { updateSession } from '@/lib/supabase/middleware';

// Next.js 16 renamed `middleware.ts` → `proxy.ts` with a `proxy` export.
export function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  // Run on everything except Next internals and static assets.
  matcher: [
    '/((?!_next/static|_next/image|robots.txt|.*\\.(?:ico|svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
