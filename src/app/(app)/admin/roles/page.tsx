import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import AdminNav from '../AdminNav';

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

      <table className="w-full text-[14px]" style={{ borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            {['Key', 'Label', 'Config'].map((h) => (
              <th
                key={h}
                className="mono text-left"
                style={{ fontSize: 10, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--muted)', padding: '10px 14px', background: 'var(--bg-alt)', borderBottom: '1px solid var(--line)' }}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {(roles ?? []).map((r) => (
            <tr key={r.id}>
              <td className="mono" style={{ padding: '12px 14px', borderBottom: '1px solid var(--line)', color: 'var(--ink)' }}>{r.key}</td>
              <td style={{ padding: '12px 14px', borderBottom: '1px solid var(--line)', color: 'var(--ink)' }}>{r.label}</td>
              <td className="mono" style={{ padding: '12px 14px', borderBottom: '1px solid var(--line)', color: 'var(--muted-2)', fontSize: 12 }}>
                {JSON.stringify(r.config)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
