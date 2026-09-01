import type { CSSProperties } from 'react';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import AdminNav from '../AdminNav';
import UsersTable from './UsersTable';

export const metadata = { title: 'Users · Adaca Red' };

export default async function AdminUsersPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  // Double-check admin here (defence in depth; the RPC also enforces it).
  const { data: me } = await supabase
    .from('users')
    .select('role')
    .eq('auth_id', user.id)
    .single();
  if (!me || !(me.role === 'admin' || me.role === 'owner')) redirect('/');

  const { data: users } = await supabase
    .from('users')
    .select('id, name, email, role')
    .order('created_at', { ascending: true });

  return (
    <div>
      <p className="eyebrow rv">Admin</p>
      <h1 className="view-title rv" style={{ '--i': 1 } as CSSProperties}>
        Users
      </h1>
      <p className="lede rv" style={{ '--i': 2 } as CSSProperties}>
        Assign each person&rsquo;s system role — admin, owner, member or viewer. A user with
        no role is blocked at sign-in until one is granted, and the change takes effect
        immediately.
      </p>

      <AdminNav />

      <div className="mt-10 rv" style={{ '--i': 3 } as CSSProperties}>
        <UsersTable users={users ?? []} />
      </div>
    </div>
  );
}
