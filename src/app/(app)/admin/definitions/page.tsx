import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { loadDefinitions } from '@/lib/definitions/server';
import DefinitionsEditor from './DefinitionsEditor';
import AdminNav from '../AdminNav';

export const metadata = { title: 'Definitions · Adaca Red' };

export default async function Page() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const { data: me } = await supabase.from('users').select('role').eq('auth_id', user.id).single();
  if (!me || !(me.role === 'admin' || me.role === 'owner')) redirect('/');

  const defs = Object.values(await loadDefinitions(supabase)).sort((a, b) =>
    a.kind === b.kind ? a.key.localeCompare(b.key) : a.kind.localeCompare(b.kind),
  );

  return (
    <div className="">
      <AdminNav />
      <h1 style={{ fontSize: 30, fontWeight: 500, letterSpacing: '-0.02em' }}>Definitions</h1>
      <p className="mt-2 mb-8 text-[14px]" style={{ color: 'var(--muted)', maxWidth: 620, lineHeight: 1.6 }}>
        The node &amp; edge type registry. Add or edit types and their fields here.
        Changes drive every form, filter and table across the app.
      </p>

      <DefinitionsEditor definitions={defs} />
    </div>
  );
}
