import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { loadDefinitions } from '@/lib/definitions/server';
import WorkflowsEditor from './WorkflowsEditor';

export const metadata = { title: 'Workflows · Adaca Red' };

export default async function Page() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const { data: me } = await supabase.from('users').select('role').eq('auth_id', user.id).single();
  if (!me || !(me.role === 'admin' || me.role === 'owner')) redirect('/');

  const defs = Object.values(await loadDefinitions(supabase));
  const workflows = defs.filter((d) => d.kind === 'workflow').sort((a, b) => a.key.localeCompare(b.key));
  const rubrics = defs.filter((d) => d.kind === 'rubric').sort((a, b) => a.key.localeCompare(b.key));
  const nodeTypes = defs.filter((d) => d.kind === 'node').sort((a, b) => a.key.localeCompare(b.key));

  // Failed runs — submissions whose pipeline stopped; admin can retry.
  const { data: failed } = await supabase
    .from('nodes')
    .select('id, created_at, data, type_key')
    .eq('data->run->>status', 'failed')
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(50);

  return (
    <div>
      <WorkflowsEditor
        workflows={workflows}
        rubrics={rubrics}
        nodeTypes={nodeTypes}
        failed={(failed ?? []).map((n) => ({
          id: n.id,
          created_at: n.created_at,
          title: String(((n.data ?? {}) as { title?: string }).title ?? n.id),
          error: String(
            (((n.data ?? {}) as { run?: { error?: string } }).run?.error ?? 'Unknown error'),
          ),
        }))}
      />
    </div>
  );
}
