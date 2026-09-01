import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { loadDefinitions } from '@/lib/definitions/server';
import DefinitionsEditor from './DefinitionsEditor';

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
    <div>
      <DefinitionsEditor definitions={defs} />
    </div>
  );
}
