'use server';

import { createClient } from '@/lib/supabase/server';
import { getDefinition, fieldsOf } from '@/lib/definitions/server';
import { listNodes } from '@/lib/nodes/queries';
import { getChoices } from '@/lib/definitions/choices';
import { formatDate } from '@/lib/format';
import type { FieldDef, NodeRow } from '@/lib/supabase/types';
import type { WidgetConfig, WidgetData, WidgetType, Measure, Filter } from './types';

const META_FIELDS: Record<string, FieldDef> = {
  created_at: { key: 'created_at', label: 'Created', data_type: 'date' },
  updated_at: { key: 'updated_at', label: 'Updated', data_type: 'date' },
};

function rawVal(node: NodeRow, key: string): unknown {
  if (key === 'created_at') return node.created_at;
  if (key === 'updated_at') return node.updated_at;
  if (key === 'id') return node.id;
  return (node.data as Record<string, unknown> | null)?.[key];
}

function displayVal(field: FieldDef | undefined, raw: unknown): string {
  if (raw === null || raw === undefined || raw === '') return '';
  const dt = field?.data_type;
  if (dt === 'date') return formatDate(raw);
  if (dt === 'boolean') return raw ? 'Yes' : 'No';
  if (dt === 'number' && field?.options?.labels?.length) {
    const min = field.options.min ?? 0;
    return field.options.labels[Number(raw) - min] ?? String(raw);
  }
  if (dt === 'enum' && field) {
    return getChoices(field).find((c) => c.key === String(raw))?.label ?? String(raw);
  }
  return String(raw);
}

function numVal(raw: unknown): number | null {
  if (raw === null || raw === undefined || raw === '') return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

function round(n: number): number {
  return Math.round(n * 100) / 100;
}

function applyFilters(nodes: NodeRow[], filters: Filter[] | undefined): NodeRow[] {
  if (!filters?.length) return nodes;
  return nodes.filter((n) =>
    filters.every((f) => (f.value ? String(rawVal(n, f.field) ?? '') === f.value : true)),
  );
}

function measureOf(nodes: NodeRow[], m: Measure | undefined): number {
  if (!m || m.kind === 'count' || !m.field) return nodes.length;
  const vals = nodes.map((n) => numVal(rawVal(n, m.field as string))).filter((v): v is number => v !== null);
  if (vals.length === 0) return 0;
  if (m.kind === 'sum') return round(vals.reduce((a, b) => a + b, 0));
  if (m.kind === 'avg') return round(vals.reduce((a, b) => a + b, 0) / vals.length);
  if (m.kind === 'min') return Math.min(...vals);
  if (m.kind === 'max') return Math.max(...vals);
  return nodes.length;
}

function pushTo<T>(map: Map<string, T[]>, key: string, val: T): void {
  const arr = map.get(key);
  if (arr) arr.push(val);
  else map.set(key, [val]);
}

function bucketLabel(raw: unknown, bucket: 'day' | 'week' | 'month'): string | null {
  if (!raw) return null;
  const d = new Date(String(raw));
  if (Number.isNaN(d.getTime())) return null;
  const pad = (n: number) => String(n).padStart(2, '0');
  if (bucket === 'month') return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}`;
  if (bucket === 'day') return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
  // week → Monday-start date
  const dt = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const dow = (dt.getUTCDay() + 6) % 7;
  dt.setUTCDate(dt.getUTCDate() - dow);
  return `${dt.getUTCFullYear()}-${pad(dt.getUTCMonth() + 1)}-${pad(dt.getUTCDate())}`;
}

/** Run a widget's configured query and return render-ready data. RLS applies. */
export async function aggregate(type: WidgetType, config: WidgetConfig): Promise<WidgetData> {
  if (type === 'note') return { kind: 'empty' };
  const supabase = await createClient();

  if (type === 'risk-matrix') {
    const risks = applyFilters(await listNodes(supabase, 'risk'), config.filters);
    const buckets: Record<string, { count: number; risks: { id: string; title: string }[] }> = {};
    for (const r of risks) {
      const d = (r.data ?? {}) as { likelihood?: number; impact?: number; title?: string };
      const l = Number(d.likelihood ?? 0);
      const i = Number(d.impact ?? 0);
      if (l >= 1 && l <= 5 && i >= 1 && i <= 5) {
        const k = `${l}-${i}`;
        (buckets[k] ??= { count: 0, risks: [] });
        buckets[k].count++;
        buckets[k].risks.push({ id: r.id, title: d.title ?? 'Untitled' });
      }
    }
    return { kind: 'matrix', buckets };
  }

  const source = config.source ?? 'initiative';
  const def = await getDefinition(supabase, source);
  const fields = def ? fieldsOf(def) : [];
  const fieldByKey = (k: string): FieldDef | undefined =>
    k === 'created_at' || k === 'updated_at' ? META_FIELDS[k] : fields.find((f) => f.key === k);
  const nodes = applyFilters(await listNodes(supabase, source), config.filters);

  if (type === 'kpi') {
    return { kind: 'kpi', value: measureOf(nodes, config.measure) };
  }

  if (type === 'table') {
    const requested = config.columns?.length ? config.columns : ['title', ...fields.slice(0, 3).map((f) => f.key)];
    const cols = requested.filter((c, i, a) => a.indexOf(c) === i);
    const rows = [...nodes];
    if (config.sort?.field) {
      const sf = config.sort.field;
      const dir = config.sort.dir === 'desc' ? -1 : 1;
      rows.sort((a, b) => {
        const av = String(rawVal(a, sf) ?? '');
        const bv = String(rawVal(b, sf) ?? '');
        return av < bv ? -dir : av > bv ? dir : 0;
      });
    }
    const limited = rows.slice(0, config.limit ?? 50);
    return {
      kind: 'table',
      columns: cols.map((c) => fieldByKey(c)?.label ?? c),
      rows: limited.map((n) => cols.map((c) => displayVal(fieldByKey(c), rawVal(n, c)))),
    };
  }

  if (type === 'donut' || type === 'bar') {
    const gb = config.groupBy;
    if (!gb) return { kind: 'empty' };
    const gf = fieldByKey(gb);
    const groups = new Map<string, NodeRow[]>();
    for (const n of nodes) pushTo(groups, displayVal(gf, rawVal(n, gb)) || 'None', n);
    const data = [...groups.entries()]
      .map(([name, ns]) => ({ name, value: measureOf(ns, config.measure) }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 12);
    return { kind: 'series', data };
  }

  if (type === 'stacked-bar') {
    const gb = config.groupBy;
    const sb = config.series;
    if (!gb || !sb) return { kind: 'empty' };
    const gf = fieldByKey(gb);
    const sf = fieldByKey(sb);
    const cats = new Map<string, Map<string, NodeRow[]>>();
    const seriesKeys = new Set<string>();
    for (const n of nodes) {
      const c = displayVal(gf, rawVal(n, gb)) || 'None';
      const s = displayVal(sf, rawVal(n, sb)) || 'None';
      seriesKeys.add(s);
      const inner = cats.get(c) ?? new Map<string, NodeRow[]>();
      pushTo(inner, s, n);
      cats.set(c, inner);
    }
    const keys = [...seriesKeys].slice(0, 8);
    const data = [...cats.entries()].slice(0, 12).map(([name, inner]) => {
      const row: Record<string, string | number> = { name };
      for (const k of keys) row[k] = measureOf(inner.get(k) ?? [], config.measure);
      return row;
    });
    return { kind: 'multi', keys, data };
  }

  if (type === 'line') {
    const tf = config.timeField ?? 'created_at';
    const bucket = config.bucket ?? 'month';
    const sb = config.series;
    const sf = sb ? fieldByKey(sb) : undefined;
    const buckets = new Map<string, Map<string, NodeRow[]>>();
    const seriesKeys = new Set<string>();
    for (const n of nodes) {
      const label = bucketLabel(rawVal(n, tf), bucket);
      if (!label) continue;
      const s = sf && sb ? displayVal(sf, rawVal(n, sb)) || 'None' : 'value';
      seriesKeys.add(s);
      const inner = buckets.get(label) ?? new Map<string, NodeRow[]>();
      pushTo(inner, s, n);
      buckets.set(label, inner);
    }
    const keys = sf ? [...seriesKeys].slice(0, 8) : ['value'];
    const data = [...buckets.entries()]
      .sort((a, b) => (a[0] < b[0] ? -1 : 1))
      .map(([name, inner]) => {
        const row: Record<string, string | number> = { name };
        for (const k of keys) row[k] = measureOf(inner.get(k) ?? [], config.measure);
        return row;
      });
    return { kind: 'multi', keys, data };
  }

  return { kind: 'empty' };
}
