import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * OAuth (Microsoft) redirect target. Exchanges the code for a session, enforces
 * the email-domain allowlist (VITE_ALLOWED_EMAIL_DOMAINS — comma-separated; empty
 * = allow any), then sends the user to the dashboard. A disallowed account is
 * signed out and bounced to /login with a message.
 */
function allowedDomains(): string[] {
  return (import.meta.env.VITE_ALLOWED_EMAIL_DOMAINS ?? '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const oauthError =
    searchParams.get('error_description') ?? searchParams.get('error');

  if (oauthError) {
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent(oauthError)}`,
    );
  }

  if (code) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      return NextResponse.redirect(
        `${origin}/login?error=${encodeURIComponent(error.message)}`,
      );
    }

    const allowed = allowedDomains();
    const domain = (data.user?.email ?? '').split('@')[1]?.toLowerCase() ?? '';
    if (allowed.length > 0 && !allowed.includes(domain)) {
      await supabase.auth.signOut();
      return NextResponse.redirect(
        `${origin}/login?error=${encodeURIComponent('Your email domain is not permitted.')}`,
      );
    }

    // Microsoft's provider_token / provider_refresh_token bloat the session
    // cookie — the Azure-specific cause of dev-server 431s. We never call Graph,
    // so drop them: one refresh returns a Supabase-only session, shrinking the
    // cookie written on the redirect. (supabase/ssr #78.)
    await supabase.auth.refreshSession();

    return NextResponse.redirect(`${origin}/`);
  }

  return NextResponse.redirect(`${origin}/login?error=missing_code`);
}
