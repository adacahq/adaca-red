import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { loadDefinitions } from '@/lib/definitions/server';
import RubricsEditor from './RubricsEditor';

export const metadata = { title: 'Rubrics · Adaca Red' };

export default async function Page() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const { data: me } = await supabase.from('users').select('role').eq('auth_id', user.id).single();
  if (!me || !(me.role === 'admin' || me.role === 'owner')) redirect('/');

  const rubrics = Object.values(await loadDefinitions(supabase))
    .filter((d) => d.kind === 'rubric')
    .sort((a, b) => a.key.localeCompare(b.key));

  return (
    <div>
      <RubricsEditor rubrics={rubrics} />
    </div>
  );
}
