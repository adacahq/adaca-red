import { ReactNode } from 'react';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { loadChoiceMeta } from '@/lib/definitions/server';
import AppShell from '@/layouts/App';

/**
 * Protected shell for every app screen. Middleware has already guaranteed a
 * session; here we enforce the system role: no role → /no-access.
 */
export default async function AppLayout({ children }: { children: ReactNode }) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('users')
    .select('name, email, role')
    .eq('auth_id', user.id)
    .single();

  if (!profile?.role) redirect('/no-access');

  const isAdmin = profile.role === 'admin' || profile.role === 'owner';
  const choiceMeta = await loadChoiceMeta(supabase);

  return (
    <AppShell
      user={{ name: profile.name, email: profile.email, role: profile.role }}
      isAdmin={isAdmin}
      choiceMeta={choiceMeta}
    >
      {children}
    </AppShell>
  );
}
