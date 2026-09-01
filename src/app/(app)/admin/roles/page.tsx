import type { CSSProperties } from 'react';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import AdminNav from '../AdminNav';
import RolesTable from './RolesTable';

export const metadata = { title: 'Roles · Adaca Red' };

export default async function Page() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const { data: me } = await supabase.from('users').select('role').eq('auth_id', user.id).single();
  if (!me || !(me.role === 'admin' || me.role === 'owner')) redirect('/');

  const { data: roles } = await supabase.from('roles').select('*').order('created_at');

  return (
    <div>
      <p className="eyebrow rv">Admin</p>
      <h1 className="view-title rv" style={{ '--i': 1 } as CSSProperties}>
        Attribution roles
      </h1>
      <p className="lede rv" style={{ '--i': 2 } as CSSProperties}>
        Roles used when assigning people to initiatives, risks and incidents — owner,
        assignee, reviewer. Distinct from the system role on a user account, which gates
        access to the app itself; these are seeded data, not editable here.
      </p>

      <AdminNav />

      <div className="mt-10 rv" style={{ '--i': 3 } as CSSProperties}>
        <RolesTable roles={roles ?? []} />
      </div>
    </div>
  );
}
