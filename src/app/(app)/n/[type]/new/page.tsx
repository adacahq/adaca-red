import EntityCreatePage from '@/components/entity/EntityCreatePage';
import { createClient } from '@/lib/supabase/server';
import { getDefinition } from '@/lib/definitions/server';
import { routeFor } from '@/lib/nodes/routes';

/** Generic create form for ANY node type. */
export default async function Page({ params }: { params: Promise<{ type: string }> }) {
  const { type } = await params;
  const supabase = await createClient();
  const def = await getDefinition(supabase, type);
  return <EntityCreatePage typeKey={type} basePath={routeFor(type)} title={def?.label ?? type} />;
}
