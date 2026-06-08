import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getDefinition, fieldsOf } from '@/lib/definitions/server';
import { getNode } from '@/lib/nodes/queries';
import Chip from './Chips';
import DeleteNodeButton from './DeleteNodeButton';
import EditNodeButton from './EditNodeButton';
import { Tabs, type TabDef } from '@/components/ui/Tabs';
import RecentsTracker from '@/components/recents/RecentsTracker';
import type { RecentType } from '@/lib/recents';

const RECENT_TYPES: RecentType[] = ['initiative', 'risk', 'incident'];

/**
 * Shared detail scaffold: header (type + status chips + title + modal Edit +
 * Delete), then tabbed content supplied by the page. Keeps each screen from
 * overloading on a single scroll.
 */
export default async function NodeShell({
  typeKey,
  basePath,
  id,
  tabs,
}: {
  typeKey: string;
  basePath: string;
  id: string;
  tabs: TabDef[];
}) {
  const supabase = await createClient();
  const def = await getDefinition(supabase, typeKey);
  const node = await getNode(supabase, id);
  if (!def || !node) notFound();

  const data = (node.data ?? {}) as Record<string, unknown>;
  const status = data.status as string | undefined;
  const severity = data.severity as string | undefined;
  const priority = data.priority as string | undefined;
  const title = (data.title as string) || 'Untitled';

  return (
    <div className="">
      {RECENT_TYPES.includes(typeKey as RecentType) && (
        <RecentsTracker type={typeKey as RecentType} id={id} title={title} />
      )}
      <div className="mb-3 flex items-center gap-3">
        <span
          className="mono"
          style={{ fontSize: 10, letterSpacing: '0.12em', color: 'var(--muted-2)', textTransform: 'uppercase' }}
        >
          {def.label}
        </span>
        {status && <Chip value={status} />}
        {severity && <Chip value={severity} />}
        {priority && <Chip value={priority} />}
        <span className="divider" style={{ flex: 1 }} aria-hidden />
        <EditNodeButton node={node} fields={fieldsOf(def)} typeLabel={def.label} revalidatePath={`${basePath}/${id}`} />
        <DeleteNodeButton id={id} redirectTo={basePath} />
      </div>

      <h1 style={{ fontSize: 30, fontWeight: 500, letterSpacing: '-0.02em', lineHeight: 1.2 }}>
        {title}
      </h1>

      <Tabs tabs={tabs} />
    </div>
  );
}
