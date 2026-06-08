import { createClient } from '@/lib/supabase/server';
import { getDefinition, fieldsOf } from '@/lib/definitions/server';
import { submitNode } from '@/lib/nodes/form-actions';
import EntityForm from './EntityForm';

export default async function EntityCreatePage({
  typeKey,
  basePath,
  title,
}: {
  typeKey: string;
  basePath: string;
  title: string;
}) {
  const supabase = await createClient();
  const def = await getDefinition(supabase, typeKey);
  if (!def) return <p style={{ color: 'var(--muted)' }}>Unknown type: {typeKey}</p>;

  const action = submitNode.bind(null, { type: typeKey, id: null, parent: null, revalidate: basePath });

  return (
    <div className="">
      <h1 className="mb-8" style={{ fontSize: 28, fontWeight: 500, letterSpacing: '-0.02em' }}>
        New {title}
      </h1>
      <EntityForm
        fields={fieldsOf(def)}
        submit={action}
        basePath={basePath}
        submitLabel="Create"
        cancelHref={basePath}
        entityLabel={title}
        mode="create"
      />
    </div>
  );
}
