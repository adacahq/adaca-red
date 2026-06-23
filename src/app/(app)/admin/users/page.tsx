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
    <div className="">
      <AdminNav />
      <h1 style={{ fontSize: 32, fontWeight: 500, letterSpacing: '-0.02em', lineHeight: 1.2 }}>
        Users
      </h1>
      <p className="mt-2 mb-8 text-[14px]" style={{ color: 'var(--muted)' }}>
        Assign a system role. A user with no role is blocked until one is granted.
      </p>

      <UsersTable users={users ?? []} />
    </div>
  );
}
