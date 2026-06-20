import EntityListPage from '@/components/entity/EntityListPage';
import { createClient } from '@/lib/supabase/server';
import { getDefinition } from '@/lib/definitions/server';
import { routeFor } from '@/lib/nodes/routes';
import { pluralize } from '@/lib/text';

/** Generic register (list) for ANY node type. The three original types keep
 *  their named routes; everything else is served here. */
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ type: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { type } = await params;
  const sp = await searchParams;
  const supabase = await createClient();
  const def = await getDefinition(supabase, type);
  const title = def ? pluralize(def.label) : type;
  return <EntityListPage typeKey={type} basePath={routeFor(type)} title={title} searchParams={sp} />;
}
