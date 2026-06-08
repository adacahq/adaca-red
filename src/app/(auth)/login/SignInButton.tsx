'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';

export default function SignInButton() {
  const [loading, setLoading] = useState(false);

  async function signIn() {
    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'azure',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
        scopes: 'email openid profile',
      },
    });
    if (error) {
      setLoading(false);
      window.location.href = `/login?error=${encodeURIComponent(error.message)}`;
    }
    // On success the browser is redirected to Microsoft.
  }

  return (
    <button
      type="button"
      className="btn btn-primary w-full"
      onClick={signIn}
      disabled={loading}
    >
      {loading && <span className="spinner" aria-hidden />}
      Sign in with Microsoft
    </button>
  );
}
