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
    <div className="">
      <AdminNav />
      <h1 style={{ fontSize: 30, fontWeight: 500, letterSpacing: '-0.02em' }}>Attribution roles</h1>
      <p className="mt-2 mb-6 text-[14px]" style={{ color: 'var(--muted)' }}>
        Roles used when assigning people to items (owner, assignee, …). Distinct from
        the top-level system role on a user account.
      </p>

      <RolesTable roles={roles ?? []} />
    </div>
  );
}
