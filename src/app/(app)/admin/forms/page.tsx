import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { loadDefinitions } from '@/lib/definitions/server';
import FormsEditor from './FormsEditor';

export const metadata = { title: 'Forms · Adaca Red' };

export default async function Page() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const { data: me } = await supabase.from('users').select('role').eq('auth_id', user.id).single();
  if (!me || !(me.role === 'admin' || me.role === 'owner')) redirect('/');

  const defs = Object.values(await loadDefinitions(supabase));
  const forms = defs.filter((d) => d.kind === 'form').sort((a, b) => a.key.localeCompare(b.key));
  const nodeTypes = defs.filter((d) => d.kind === 'node').sort((a, b) => a.key.localeCompare(b.key));
  const workflows = defs.filter((d) => d.kind === 'workflow').sort((a, b) => a.key.localeCompare(b.key));

  return (
    <div>
      <FormsEditor forms={forms} nodeTypes={nodeTypes} workflows={workflows} />
    </div>
  );
}
