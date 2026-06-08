import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import RoleSelect from './RoleSelect';
import AdminNav from '../AdminNav';

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

      <table className="w-full text-[14px]" style={{ borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            {['User', 'Email', 'Role'].map((h) => (
              <th
                key={h}
                className="mono text-left"
                style={{
                  fontSize: 10,
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                  color: 'var(--muted)',
                  padding: '10px 14px',
                  background: 'var(--bg-alt)',
                  borderBottom: '1px solid var(--line)',
                }}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {(users ?? []).map((u) => (
            <tr key={u.id}>
              <td style={{ padding: '12px 14px', borderBottom: '1px solid var(--line)', color: 'var(--ink)' }}>
                {u.name ?? '–'}
              </td>
              <td style={{ padding: '12px 14px', borderBottom: '1px solid var(--line)', color: 'var(--muted)' }}>
                {u.email ?? '–'}
              </td>
              <td style={{ padding: '12px 14px', borderBottom: '1px solid var(--line)' }}>
                <RoleSelect userId={u.id} role={u.role} />
              </td>
            </tr>
          ))}
          {(!users || users.length === 0) && (
            <tr>
              <td colSpan={3} style={{ padding: '24px 14px', color: 'var(--muted-2)' }}>
                No users yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
