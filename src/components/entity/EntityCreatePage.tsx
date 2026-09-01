import type { CSSProperties } from 'react';
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
    <div>
      <p className="eyebrow rv">New</p>
      <h1 className="view-title rv" style={{ '--i': 1 } as CSSProperties}>
        New {title}
      </h1>
      <p className="lede rv" style={{ '--i': 2 } as CSSProperties}>
        Fill in the fields below to add a {title.toLowerCase()} to the register.
      </p>

      <div className="mt-10">
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
    </div>
  );
}
