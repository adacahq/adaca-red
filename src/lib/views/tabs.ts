import { childTypesOf, edgeRelations } from './registry';
import { pluralize } from '@/lib/text';
import type { DefinitionRow, ViewKind } from '@/lib/supabase/types';

/** A structural tab derived from the definition graph (before the config
 *  overlay). Pure + isomorphic so both the server renderer (`nodeTabs`) and the
 *  client admin editor (`TabsEditor`) derive the same defaults. */
export interface DerivedTab {
  ref: string;
  defaultLabel: string;
  kind: ViewKind;
  meta: Record<string, unknown>;
}

/** Overview + one per child type (containment) + one per edge relation
 *  (association) + Activity, each with a stable `ref`. */
export function deriveStructural(def: DefinitionRow, defs: Record<string, DefinitionRow>): DerivedTab[] {
  const out: DerivedTab[] = [];
  out.push({ ref: 'overview', defaultLabel: 'Overview', kind: 'overview', meta: {} });

  for (const c of childTypesOf(def, defs)) {
    out.push({ ref: `child:${c.key}`, defaultLabel: pluralize(c.label), kind: 'children', meta: { childType: c.key } });
  }

  for (const r of edgeRelations(def, defs)) {
    out.push({
      ref: `edge:${r.edgeKey}:${r.direction}:${r.partner}`,
      defaultLabel: r.edgeLabel,
      kind: 'edge',
      meta: { edgeKey: r.edgeKey, direction: r.direction, partner: r.partner },
    });
  }

  out.push({ ref: 'activity', defaultLabel: 'Activity', kind: 'activity', meta: {} });
  return out;
}
