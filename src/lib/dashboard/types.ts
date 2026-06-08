/** Shared types for the customisable dashboard. */

export type Source = 'initiative' | 'risk' | 'incident';
export const SOURCES: Source[] = ['initiative', 'risk', 'incident'];

export type WidgetType =
  | 'kpi'
  | 'table'
  | 'donut'
  | 'bar'
  | 'stacked-bar'
  | 'line'
  | 'risk-matrix'
  | 'note';

export type MeasureKind = 'count' | 'sum' | 'avg' | 'min' | 'max';
export interface Measure {
  kind: MeasureKind;
  field?: string; // required for sum/avg/min/max
}

export type FilterOp = 'eq';
export interface Filter {
  field: string;
  op: FilterOp;
  value: string;
}

/** One flexible config bag; only the keys relevant to a widget type are read. */
export interface WidgetConfig {
  source?: Source;
  filters?: Filter[];
  measure?: Measure;
  groupBy?: string;
  series?: string;
  columns?: string[];
  sort?: { field: string; dir: 'asc' | 'desc' };
  limit?: number;
  timeField?: string;
  bucket?: 'day' | 'week' | 'month';
  markdown?: string;
}

export interface WidgetInstance {
  id: string;
  type: WidgetType;
  title?: string;
  x: number;
  y: number;
  w: number;
  h: number;
  config: WidgetConfig;
}

/** Render-ready output of the aggregation engine, by widget shape. */
export type WidgetData =
  | { kind: 'kpi'; value: number }
  | { kind: 'table'; columns: string[]; rows: string[][] }
  | { kind: 'series'; data: { name: string; value: number }[] }
  | { kind: 'multi'; keys: string[]; data: Record<string, string | number>[] }
  | { kind: 'matrix'; buckets: Record<string, { count: number; risks: { id: string; title: string }[] }> }
  | { kind: 'empty' };

/** Field metadata for a source, handed to the builder so it can offer valid fields. */
export interface SourceMeta {
  key: Source;
  label: string;
  fields: import('@/lib/supabase/types').FieldDef[];
}
