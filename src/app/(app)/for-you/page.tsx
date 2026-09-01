import type { CSSProperties } from 'react';
import { createClient } from '@/lib/supabase/server';
import { loadDefinitions, fieldsOf } from '@/lib/definitions/server';
import { forYouFieldsByType, forYouItems } from '@/lib/forYou/queries';
import { loadForYouConfig } from '@/lib/forYou/actions';
import ForYouView, { type TypeMeta } from '@/components/forYou/ForYouView';

export const metadata = { title: 'For You · Adaca Red' };

export default async function Page() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null; // layout already gates auth

  const { data: profile } = await supabase.from('users').select('id').eq('auth_id', user.id).single();
  const userId = profile?.id ?? '';

  const [defs, config] = await Promise.all([loadDefinitions(supabase), loadForYouConfig()]);
  const items = await forYouItems(supabase, userId, defs);

  // Metadata for the For-You types (label + fields), so the client can render
  // each cell with the row's own type definition.
  const typeMeta: Record<string, TypeMeta> = {};
  for (const typeKey of Object.keys(forYouFieldsByType(defs))) {
    const def = defs[typeKey];
    if (def) typeMeta[typeKey] = { label: def.label, fields: fieldsOf(def) };
  }

  return (
    <div>
      <p className="eyebrow rv">For You</p>
      <h1 className="view-title rv" style={{ '--i': 1 } as CSSProperties}>
        For You
      </h1>
      <p className="lede rv" style={{ '--i': 2 } as CSSProperties}>
        Everything across the system where you’re the assigned person.
      </p>

      <div className="mt-10">
        <ForYouView items={items} typeMeta={typeMeta} initialConfig={config} />
      </div>
    </div>
  );
}
