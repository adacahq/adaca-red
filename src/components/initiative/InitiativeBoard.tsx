import { createClient } from '@/lib/supabase/server';
import { getDefinition, fieldsOf } from '@/lib/definitions/server';
import { getChoices } from '@/lib/definitions/choices';
import { getSubtree } from '@/lib/nodes/queries';
import KanbanBoard from './KanbanBoard';

/** Server loader for the initiative Kanban: tasks (top-level + per group), the
 *  task status options, and the task field defs for the card editor. */
export default async function InitiativeBoard({ initiativeId }: { initiativeId: string }) {
  const supabase = await createClient();
  const [taskDef, subtree] = await Promise.all([
    getDefinition(supabase, 'task'),
    getSubtree(supabase, initiativeId),
  ]);

  const statusField = taskDef ? fieldsOf(taskDef).find((f) => f.key === 'status') : undefined;
  const statusKeys = getChoices(statusField).map((c) => c.key);
  const statuses = statusKeys.length ? statusKeys : ['todo', 'in_progress', 'blocked', 'done'];

  const groups = subtree.filter((n) => n.type_key === 'group');
  const tasks = subtree
    .filter((n) => n.type_key === 'task')
    .map((n) => {
      const d = (n.data ?? {}) as Record<string, unknown>;
      return {
        id: n.id,
        title: (d.title as string) ?? 'Untitled',
        status: (d.status as string) ?? '',
        parentId: n.parent_id ?? initiativeId,
        data: d,
      };
    });

  const containers = [
    { id: '__all__', label: 'All tasks' },
    { id: initiativeId, label: 'Top level', dividerBefore: true },
    ...groups.map((g, i) => ({
      id: g.id,
      label: ((g.data ?? {}) as { title?: string }).title ?? 'Group',
      dividerBefore: i === 0,
    })),
  ];

  return (
    <KanbanBoard
      initiativeId={initiativeId}
      containers={containers}
      tasks={tasks}
      statuses={statuses}
      taskFields={taskDef ? fieldsOf(taskDef) : []}
      revalidatePath={`/initiatives/${initiativeId}`}
    />
  );
}
