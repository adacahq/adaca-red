import { createClient } from '@/lib/supabase/server';
import { listAssignments, listUsers } from '@/lib/nodes/queries';
import AssignmentsPanel from './AssignmentsPanel';

/** Server wrapper: loads users/roles/assignments for a node → AssignmentsPanel. */
export default async function AssignmentsSection({
  nodeId,
  revalidatePath,
}: {
  nodeId: string;
  revalidatePath: string;
}) {
  const supabase = await createClient();
  const [assignments, users, rolesRes] = await Promise.all([
    listAssignments(supabase, nodeId),
    listUsers(supabase),
    supabase.from('roles').select('key, label'),
  ]);
  return (
    <AssignmentsPanel
      nodeId={nodeId}
      users={users.map((u) => ({ id: u.id, name: u.name, email: u.email }))}
      roles={rolesRes.data ?? []}
      assignments={assignments.map((a) => ({ id: a.id, user_id: a.user_id, role_key: a.role_key }))}
      revalidate={revalidatePath}
    />
  );
}
