import type { ReactNode } from 'react';
import { createClient } from '@/lib/supabase/server';
import { loadDefinitions, nodeConfig, fieldsOf } from '@/lib/definitions/server';
import { getNode } from '@/lib/nodes/queries';
import {
  edgeRelations,
  isViewAvailable,
  boardDefaults,
  VIEW_BY_KIND,
} from '@/lib/views/registry';
import { deriveStructural, type DerivedTab } from '@/lib/views/tabs';
import { routeFor } from '@/lib/nodes/routes';
import type { DefinitionRow, NodeRow, TabSpec, ViewKind } from '@/lib/supabase/types';
import type { TabDef } from '@/components/ui/Tabs';

import FieldsSection from './FieldsSection';
import AssignmentsSection from './AssignmentsSection';
import RevisionsPanel from './RevisionsPanel';
import ContainmentTree from './ContainmentTree';
import PlainEdges from '@/components/edges/PlainEdges';
import SectionHeader from '@/components/canvas/SectionHeader';
import Board from '@/components/board/Board';
import InitiativeMitigations from '@/components/red/InitiativeMitigations';
import RiskMitigations from '@/components/red/RiskMitigations';
import IncidentTimeline from '@/components/incident/IncidentTimeline';

/** Merge the stored `config.tabs` overlay with the derived defaults, preserving
 *  stored order and appending any derived tab the overlay didn't mention (so a
 *  newly-added child/edge type surfaces automatically). */
function mergeOrder(derived: DerivedTab[], stored: TabSpec[]): Array<{ d?: DerivedTab; spec?: TabSpec }> {
  const byRef = new Map(derived.map((d) => [d.ref, d]));
  const consumed = new Set<string>();
  const result: Array<{ d?: DerivedTab; spec?: TabSpec }> = [];

  for (const spec of stored) {
    if (spec.ref && byRef.has(spec.ref)) {
      consumed.add(spec.ref);
      result.push({ d: byRef.get(spec.ref), spec });
    } else if (spec.kind && !spec.ref) {
      result.push({ spec }); // an added optional view
    }
    // else: stale ref / unknown entry — drop it
  }
  for (const d of derived) if (!consumed.has(d.ref)) result.push({ d });
  return result;
}

interface RenderCtx {
  id: string;
  path: string;
  def: DefinitionRow;
  defs: Record<string, DefinitionRow>;
  node: NodeRow;
  meta: Record<string, unknown>;
}

/** kind → content. Reuses existing components; nothing new is rendered here. */
function renderView(kind: ViewKind, c: RenderCtx): ReactNode {
  switch (kind) {
    case 'overview':
      return (
        <>
          <FieldsSection typeKey={c.def.key} id={c.id} />
          <SectionHeader title="People" />
          <AssignmentsSection nodeId={c.id} revalidatePath={c.path} />
        </>
      );
    case 'children': {
      const childType = c.meta.childType as string;
      const onlyTypes = (c.meta.onlyTypes as string[] | undefined) ?? [childType];
      return <ContainmentTree rootId={c.id} revalidatePath={c.path} onlyTypes={onlyTypes} />;
    }
    case 'edge': {
      const edgeKey = c.meta.edgeKey as string;
      const direction = c.meta.direction as 'from' | 'to';
      const partner = c.meta.partner as string;
      const partnerLabel = c.defs[partner]?.label ?? partner;
      return (
        <PlainEdges
          nodeId={c.id}
          edgeType={edgeKey}
          direction={direction}
          targetType={partner}
          targetBasePath={routeFor(partner)}
          revalidatePath={c.path}
          addLabel={`Link ${partnerLabel.toLowerCase()}`}
        />
      );
    }
    case 'activity':
      return <RevisionsPanel kind="node" id={c.id} />;
    case 'board': {
      // Resolve the board's source: explicit config, else the first child type
      // with an enum field, grouped by that field.
      const fallback = boardDefaults(c.def, c.defs);
      const childType = (c.meta.childType as string | undefined) ?? fallback?.childType;
      if (!childType || !c.defs[childType]) return null;
      const enumKeys = fieldsOf(c.defs[childType]).filter((f) => f.data_type === 'enum').map((f) => f.key);
      const groupBy = (c.meta.groupBy as string | undefined) ?? fallback?.groupBy ?? enumKeys[0];
      if (!groupBy) return null;
      const containerTypes = (c.meta.containerTypes as string[] | undefined) ?? [];
      return (
        <Board
          rootId={c.id}
          childType={childType}
          groupBy={groupBy}
          containerTypes={containerTypes}
          revalidatePath={c.path}
        />
      );
    }
    case 'red': {
      // RED has two sides; pick by which side of `mitigates` this type sits on.
      const onFrom = edgeRelations(c.def, c.defs).some((r) => r.edgeKey === 'mitigates' && r.direction === 'from');
      return onFrom
        ? <InitiativeMitigations initiativeId={c.id} />
        : <RiskMitigations riskId={c.id} riskData={(c.node.data ?? {}) as Record<string, unknown>} />;
    }
    case 'timeline':
      return <IncidentTimeline incidentId={c.id} />;
    default:
      return null;
  }
}

/**
 * Build a node's detail-screen tabs from its definition: derived structural
 * tabs overlaid with the definition's `config.tabs` (order / hide / relabel /
 * added views). Replaces the hand-assembled `TabDef[]` arrays the detail pages
 * used to carry, and the old `childTypeTabs` helper.
 */
export default async function nodeTabs({
  typeKey,
  id,
  path,
}: {
  typeKey: string;
  id: string;
  path: string;
}): Promise<TabDef[]> {
  const supabase = await createClient();
  const [defs, node] = await Promise.all([loadDefinitions(supabase), getNode(supabase, id)]);
  const def = defs[typeKey];
  if (!def || !node) return [];

  const derived = deriveStructural(def, defs);
  const stored = (nodeConfig(def).tabs ?? []) as TabSpec[];
  const order = mergeOrder(derived, stored);

  const tabs: TabDef[] = [];
  for (const e of order) {
    if (e.spec?.hidden) continue;
    const kind = (e.d?.kind ?? e.spec?.kind) as ViewKind | undefined;
    if (!kind) continue;

    // Added optional views render only while their circumstance holds.
    if (!e.d && (kind === 'board' || kind === 'red' || kind === 'timeline')) {
      if (!isViewAvailable(kind, { def, defs })) continue;
    }

    const key = e.spec?.id ?? e.d?.ref ?? kind;
    const label = e.spec?.label ?? e.d?.defaultLabel ?? VIEW_BY_KIND[kind]?.title ?? key;
    const meta = { ...(e.d?.meta ?? {}), ...(e.spec?.config ?? {}) };
    const content = renderView(kind, { id, path, def, defs, node, meta });
    if (content == null) continue;
    tabs.push({ key, label, content });
  }
  return tabs;
}
