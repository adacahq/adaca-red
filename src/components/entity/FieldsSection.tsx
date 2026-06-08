import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getDefinition } from '@/lib/definitions/server';
import { getNode } from '@/lib/nodes/queries';
import FieldsPanel from './FieldsPanel';

/** Server wrapper: loads a node + its definition → FieldsPanel (read view). */
export default async function FieldsSection({
  typeKey,
  id,
  exclude,
}: {
  typeKey: string;
  id: string;
  exclude?: string[];
}) {
  const supabase = await createClient();
  const def = await getDefinition(supabase, typeKey);
  const node = await getNode(supabase, id);
  if (!def || !node) notFound();
  return <FieldsPanel def={def} data={(node.data ?? {}) as Record<string, unknown>} exclude={exclude} />;
}
