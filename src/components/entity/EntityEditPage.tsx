import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getDefinition, fieldsOf } from '@/lib/definitions/server';
import { getNode } from '@/lib/nodes/queries';
import { submitNode } from '@/lib/nodes/form-actions';
import EntityForm from './EntityForm';

export default async function EntityEditPage({
  typeKey,
  basePath,
  id,
  title,
}: {
  typeKey: string;
  basePath: string;
  id: string;
  title: string;
}) {
  const supabase = await createClient();
  const def = await getDefinition(supabase, typeKey);
  const node = await getNode(supabase, id);
  if (!def || !node) notFound();

  const action = submitNode.bind(null, { type: typeKey, id, parent: node.parent_id, revalidate: basePath });

  return (
    <div className="">
      <h1 className="mb-8" style={{ fontSize: 28, fontWeight: 500, letterSpacing: '-0.02em' }}>
        Edit {title}
      </h1>
      <EntityForm
        fields={fieldsOf(def)}
        initial={(node.data ?? {}) as Record<string, unknown>}
        submit={action}
        basePath={basePath}
        submitLabel="Save"
        cancelHref={`${basePath}/${id}`}
        entityLabel={title}
        mode="edit"
      />
    </div>
  );
}
