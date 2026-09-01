import type { CSSProperties } from 'react';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getDefinition, fieldsOf } from '@/lib/definitions/server';
import { getNode } from '@/lib/nodes/queries';
import { formatDate } from '@/lib/format';
import Chip from './Chips';
import DeleteNodeButton from './DeleteNodeButton';
import EditNodeButton from './EditNodeButton';
import { Tabs, type TabDef } from '@/components/ui/Tabs';
import RecentsTracker from '@/components/recents/RecentsTracker';

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
  const hasChips = !!(status || severity || priority);

  return (
    <div>
      <RecentsTracker type={typeKey} id={id} title={title} />
      <p className="eyebrow rv">{def.label}</p>
      <div className="flex items-end justify-between gap-6 flex-wrap">
        <h1 className="view-title rv" style={{ '--i': 1 } as CSSProperties}>
          {title}
        </h1>
        <span className="rv flex items-center gap-3" style={{ '--i': 2 } as CSSProperties}>
          <EditNodeButton node={node} fields={fieldsOf(def)} typeLabel={def.label} revalidatePath={`${basePath}/${id}`} />
          <DeleteNodeButton id={id} redirectTo={basePath} />
        </span>
      </div>
      <p className="lede rv" style={{ '--i': 2 } as CSSProperties}>
        {def.label} record, tracked since {formatDate(node.created_at)}.
      </p>
      {hasChips && (
        <div className="rv flex items-center gap-2" style={{ '--i': 3 } as CSSProperties}>
          {status && <Chip value={status} />}
          {severity && <Chip value={severity} />}
          {priority && <Chip value={priority} />}
        </div>
      )}

      <Tabs tabs={tabs} />
    </div>
  );
}
