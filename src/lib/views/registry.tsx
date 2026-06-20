import type { ComponentType, SVGProps } from 'react';
import {
  DocumentTextIcon,
  RectangleStackIcon,
  LinkIcon,
  ClockIcon,
  ViewColumnsIcon,
  ShieldExclamationIcon,
  CalendarDaysIcon,
} from '@heroicons/react/24/outline';
import type { DefinitionRow, ViewKind } from '@/lib/supabase/types';
import { fieldsOf, nodeConfig, edgeConfig } from '@/lib/definitions/server';

/**
 * The view registry: the "code half" of the display layer (the per-definition
 * `config.tabs` is the data half). Each view kind declares where it can be used
 * and an `available` predicate — the circumstance under which it may be added to
 * a type. Structural kinds are derived defaults; the rest are user-added.
 *
 * The render half (kind → ReactNode) lives in `components/entity/nodeTabs.tsx`,
 * because it composes server components; this module stays JSX-free so it can be
 * imported anywhere (including the admin editor).
 */
export interface ViewCtx {
  def: DefinitionRow;
  defs: Record<string, DefinitionRow>;
}

export interface ViewMeta {
  kind: ViewKind;
  title: string;
  description: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  scope: 'detail' | 'list' | 'both';
  /** Structural views are auto-derived; non-structural ones are user-added. */
  structural: boolean;
  available(ctx: ViewCtx): boolean;
}

// ── graph helpers (shared by derivation + predicates) ────────────────────────

/** Node types whose `allowedParents` includes this type — its child types. */
export function childTypesOf(def: DefinitionRow, defs: Record<string, DefinitionRow>): DefinitionRow[] {
  return Object.values(defs).filter(
    (d) => d.kind === 'node' && (nodeConfig(d).allowedParents ?? []).includes(def.key),
  );
}

export interface EdgeRelation {
  edgeKey: string;
  edgeLabel: string;
  direction: 'from' | 'to';
  partner: string;
}

/**
 * Concrete edge relations touching this type, one per partner, read from the
 * edge's explicit `pairs`. A pair whose partner side is the `*` wildcard (the
 * loose `related` edge) yields no concrete partner and is skipped — a generic
 * "Related" view is a later concern. Deduped by edge+direction+partner.
 */
export function edgeRelations(def: DefinitionRow, defs: Record<string, DefinitionRow>): EdgeRelation[] {
  const seen = new Set<string>();
  const rels: EdgeRelation[] = [];
  const add = (edgeKey: string, edgeLabel: string, direction: 'from' | 'to', partner: string) => {
    if (partner === '*') return;
    const id = `${edgeKey}:${direction}:${partner}`;
    if (seen.has(id)) return;
    seen.add(id);
    rels.push({ edgeKey, edgeLabel, direction, partner });
  };
  for (const d of Object.values(defs)) {
    if (d.kind !== 'edge') continue;
    for (const p of edgeConfig(d).pairs ?? []) {
      if (p.from === def.key || p.from === '*') add(d.key, d.label, 'from', p.to);
      if (p.to === def.key || p.to === '*') add(d.key, d.label, 'to', p.from);
    }
  }
  return rels;
}

function participatesInMitigates(def: DefinitionRow, defs: Record<string, DefinitionRow>): boolean {
  const m = defs['mitigates'];
  if (!m) return false;
  return (edgeConfig(m).pairs ?? []).some((p) => p.from === def.key || p.to === def.key);
}

function hasDateField(def: DefinitionRow): boolean {
  return fieldsOf(def).some((f) => f.data_type === 'date');
}

function childHasEnum(def: DefinitionRow, defs: Record<string, DefinitionRow>): boolean {
  return childTypesOf(def, defs).some((c) => fieldsOf(c).some((f) => f.data_type === 'enum'));
}

/**
 * Default board config for a type: the first child type that has an enum field,
 * grouped by that field. Used when a board view is added without explicit config
 * (the admin picker, or a brand-new type). Returns null if no child type can be
 * laid out as a board.
 */
export function boardDefaults(
  def: DefinitionRow,
  defs: Record<string, DefinitionRow>,
): { childType: string; groupBy: string } | null {
  for (const c of childTypesOf(def, defs)) {
    const enumField = fieldsOf(c).find((f) => f.data_type === 'enum');
    if (enumField) return { childType: c.key, groupBy: enumField.key };
  }
  return null;
}

// ── the catalog ──────────────────────────────────────────────────────────────

export const VIEWS: ViewMeta[] = [
  { kind: 'overview', title: 'Overview', description: 'The type’s own fields.', icon: DocumentTextIcon, scope: 'detail', structural: true, available: () => true },
  { kind: 'children', title: 'Children', description: 'A child node type, as a containment tree.', icon: RectangleStackIcon, scope: 'detail', structural: true, available: (c) => childTypesOf(c.def, c.defs).length > 0 },
  { kind: 'edge', title: 'Linked', description: 'Nodes linked via an edge type.', icon: LinkIcon, scope: 'detail', structural: true, available: (c) => edgeRelations(c.def, c.defs).length > 0 },
  { kind: 'activity', title: 'Activity', description: 'Revision history.', icon: ClockIcon, scope: 'detail', structural: true, available: () => true },
  { kind: 'board', title: 'Board', description: 'Kanban of a child type, grouped by a status field.', icon: ViewColumnsIcon, scope: 'both', structural: false, available: (c) => childHasEnum(c.def, c.defs) },
  { kind: 'red', title: 'RED', description: 'Relevance·Extent·Duration mitigation scoring.', icon: ShieldExclamationIcon, scope: 'detail', structural: false, available: (c) => participatesInMitigates(c.def, c.defs) },
  { kind: 'timeline', title: 'Timeline', description: 'A chronology — available when the type has a date field.', icon: CalendarDaysIcon, scope: 'detail', structural: false, available: (c) => hasDateField(c.def) },
];

export const VIEW_BY_KIND: Record<ViewKind, ViewMeta> = Object.fromEntries(
  VIEWS.map((v) => [v.kind, v]),
) as Record<ViewKind, ViewMeta>;

export function isViewAvailable(kind: ViewKind, ctx: ViewCtx): boolean {
  return VIEW_BY_KIND[kind]?.available(ctx) ?? false;
}

/** Non-structural views currently addable to this type (for the admin picker). */
export function addableViews(ctx: ViewCtx): ViewMeta[] {
  return VIEWS.filter((v) => !v.structural && v.available(ctx));
}
