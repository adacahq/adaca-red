import { ReactNode } from 'react';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { loadChoiceMeta, loadDefinitions, nodeConfig } from '@/lib/definitions/server';
import { pluralize } from '@/lib/text';
import { routeFor } from '@/lib/nodes/routes';
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
  const [choiceMeta, defs] = await Promise.all([loadChoiceMeta(supabase), loadDefinitions(supabase)]);

  const nodeDefs = Object.values(defs).filter((d) => d.kind === 'node');

  // The entire Register nav section is config-driven: every node type flagged
  // "show in sidebar" (Admin → Definitions → Views), with its chosen icon.
  const register = nodeDefs
    .filter((d) => nodeConfig(d).sidebar === true)
    .map((d) => ({ name: pluralize(d.label), href: routeFor(d.key), icon: nodeConfig(d).icon }))
    .sort((a, b) => a.name.localeCompare(b.name));

  // type key → icon name, so the (client) recents list can resolve any type.
  const typeIcons = Object.fromEntries(nodeDefs.map((d) => [d.key, nodeConfig(d).icon ?? '']));

  return (
    <AppShell
      user={{ name: profile.name, email: profile.email, role: profile.role }}
      isAdmin={isAdmin}
      choiceMeta={choiceMeta}
      register={register}
      typeIcons={typeIcons}
    >
      {children}
    </AppShell>
  );
}
