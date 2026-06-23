'use client';

import { useState, type CSSProperties } from 'react';
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import RichTextView from '@/components/rich-text/RichTextView';
import RiskMatrix from '@/components/reports/RiskMatrix';
import type { WidgetConfig, WidgetData, WidgetInstance } from '@/lib/dashboard/types';

// Theme-aware series slots: dark canvas runs lightest→darkest, light canvas
// darkest→lightest (the direction is encoded in --series-* in globals.css).
const SERIES = [
  'var(--series-1)',
  'var(--series-2)',
  'var(--series-3)',
  'var(--series-4)',
  'var(--series-5)',
  'var(--series-6)',
];
const axisTick = { fontSize: 10, fontFamily: 'var(--font-mono)', fill: 'var(--muted-2)' };
const TOOLTIP: CSSProperties = { fontSize: 12, background: 'var(--bg-elev)', border: '1px solid var(--line-strong)', color: 'var(--ink)' };
const TH: CSSProperties = { fontSize: 9, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--muted)', padding: '7px 10px', background: 'var(--bg-alt)', borderBottom: '1px solid var(--line)', textAlign: 'left', position: 'sticky', top: 0 };
const TD: CSSProperties = { padding: '7px 10px', borderBottom: '1px solid var(--line)', whiteSpace: 'nowrap' };

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-full w-full items-center justify-center text-center text-[13px]" style={{ color: 'var(--muted-2)', minHeight: 80 }}>
      {children}
    </div>
  );
}

function ChartFrame({ children }: { children: React.ReactElement }) {
  return (
    <div style={{ width: '100%', height: '100%', minHeight: 150 }}>
      <ResponsiveContainer width="100%" height="100%">{children}</ResponsiveContainer>
    </div>
  );
}

function measureLabel(config: WidgetConfig): string {
  const m = config.measure;
  if (!m || m.kind === 'count') return config.source ? `Count of ${config.source}s` : 'Count';
  return `${m.kind} of ${m.field ?? ''}`;
}

function KpiBody({ value, label }: { value: number; label: string }) {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center text-center">
      <span className="mono" style={{ fontSize: 40, fontWeight: 500, color: 'var(--ink)', letterSpacing: '-0.02em', lineHeight: 1 }}>
        {value.toLocaleString()}
      </span>
      <span className="mono" style={{ fontSize: 9.5, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--muted-2)', marginTop: 8 }}>
        {label}
      </span>
    </div>
  );
}

function TableBody({ columns, rows }: { columns: string[]; rows: string[][] }) {
  // Sort by column index; local state so a refresh resets it.
  const [sort, setSort] = useState<{ i: number; dir: 'asc' | 'desc' } | null>(null);
  if (rows.length === 0) return <Centered>No rows</Centered>;

  const sorted = sort
    ? [...rows].sort(
        (a, b) =>
          (sort.dir === 'asc' ? 1 : -1) *
          String(a[sort.i] ?? '').localeCompare(String(b[sort.i] ?? ''), undefined, { numeric: true, sensitivity: 'base' }),
      )
    : rows;
  const toggle = (i: number) =>
    setSort((s) => (!s || s.i !== i ? { i, dir: 'asc' } : s.dir === 'asc' ? { i, dir: 'desc' } : null));

  return (
    <table className="w-full text-[13px]" style={{ borderCollapse: 'collapse' }}>
      <thead>
        <tr>
          {columns.map((c, ci) => {
            const activeSort = sort?.i === ci ? sort : null;
            return (
              <th
                key={c}
                className="mono"
                style={{ ...TH, cursor: 'pointer', userSelect: 'none' }}
                onClick={() => toggle(ci)}
                aria-sort={activeSort ? (activeSort.dir === 'asc' ? 'ascending' : 'descending') : undefined}
              >
                {c}
                {activeSort && <span style={{ color: 'var(--accent)' }}>{activeSort.dir === 'asc' ? ' ▲' : ' ▼'}</span>}
              </th>
            );
          })}
        </tr>
      </thead>
      <tbody>
        {sorted.map((r, ri) => (
          <tr key={ri}>
            {r.map((cell, ci) => (
              <td key={ci} style={{ ...TD, color: ci === 0 ? 'var(--ink)' : 'var(--muted)', fontWeight: ci === 0 ? 500 : 400 }}>
                {cell || '–'}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function DonutBody({ data }: { data: { name: string; value: number }[] }) {
  if (data.length === 0) return <Centered>No data</Centered>;
  return (
    <ChartFrame>
      <PieChart>
        {/* Start at 12 o'clock and sweep clockwise; data arrives sorted largest→smallest. */}
        <Pie
          data={data}
          dataKey="value"
          nameKey="name"
          innerRadius="55%"
          outerRadius="82%"
          paddingAngle={1}
          stroke="var(--bg)"
          startAngle={90}
          endAngle={-270}
        >
          {data.map((_, i) => <Cell key={i} fill={SERIES[i % SERIES.length]} />)}
        </Pie>
        <Tooltip contentStyle={TOOLTIP} />
        <Legend wrapperStyle={{ fontSize: 11 }} />
      </PieChart>
    </ChartFrame>
  );
}

function BarBody({ data }: { data: { name: string; value: number }[] }) {
  if (data.length === 0) return <Centered>No data</Centered>;
  return (
    <ChartFrame>
      <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -18 }}>
        <CartesianGrid vertical={false} stroke="var(--line)" />
        <XAxis dataKey="name" tick={axisTick} tickLine={false} axisLine={{ stroke: 'var(--line)' }} interval={0} />
        <YAxis tick={axisTick} tickLine={false} axisLine={false} allowDecimals={false} />
        <Tooltip cursor={{ fill: 'rgba(255,255,255,0.04)' }} contentStyle={TOOLTIP} />
        <Bar dataKey="value" fill="var(--accent)" />
      </BarChart>
    </ChartFrame>
  );
}

function StackedBarBody({ keys, data }: { keys: string[]; data: Record<string, string | number>[] }) {
  if (data.length === 0) return <Centered>No data</Centered>;
  return (
    <ChartFrame>
      <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -18 }}>
        <CartesianGrid vertical={false} stroke="var(--line)" />
        <XAxis dataKey="name" tick={axisTick} tickLine={false} axisLine={{ stroke: 'var(--line)' }} interval={0} />
        <YAxis tick={axisTick} tickLine={false} axisLine={false} allowDecimals={false} />
        <Tooltip cursor={{ fill: 'rgba(255,255,255,0.04)' }} contentStyle={TOOLTIP} />
        <Legend wrapperStyle={{ fontSize: 11 }} />
        {keys.map((k, i) => <Bar key={k} dataKey={k} stackId="s" fill={SERIES[i % SERIES.length]} />)}
      </BarChart>
    </ChartFrame>
  );
}

function LineBody({ keys, data }: { keys: string[]; data: Record<string, string | number>[] }) {
  if (data.length === 0) return <Centered>No data</Centered>;
  return (
    <ChartFrame>
      <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -18 }}>
        <CartesianGrid vertical={false} stroke="var(--line)" />
        <XAxis dataKey="name" tick={axisTick} tickLine={false} axisLine={{ stroke: 'var(--line)' }} />
        <YAxis tick={axisTick} tickLine={false} axisLine={false} allowDecimals={false} />
        <Tooltip contentStyle={TOOLTIP} />
        {keys.length > 1 && <Legend wrapperStyle={{ fontSize: 11 }} />}
        {keys.map((k, i) => (
          <Line key={k} type="monotone" dataKey={k} stroke={SERIES[i % SERIES.length]} strokeWidth={2} dot={false} name={k === 'value' ? 'Value' : k} />
        ))}
      </LineChart>
    </ChartFrame>
  );
}

function NoteBody({ markdown }: { markdown: string }) {
  if (!markdown.trim()) return <Centered>Empty note. Configure to add text.</Centered>;
  return <div className="text-[14px]" style={{ color: 'var(--ink)' }}><RichTextView value={markdown} /></div>;
}

export function WidgetBody({ instance, data }: { instance: WidgetInstance; data: WidgetData | null }) {
  if (instance.type === 'note') return <NoteBody markdown={instance.config.markdown ?? ''} />;
  if (!data) return null;
  switch (data.kind) {
    case 'kpi':
      return <KpiBody value={data.value} label={measureLabel(instance.config)} />;
    case 'table':
      return <TableBody columns={data.columns} rows={data.rows} />;
    case 'series':
      return instance.type === 'donut' ? <DonutBody data={data.data} /> : <BarBody data={data.data} />;
    case 'multi':
      return instance.type === 'line'
        ? <LineBody keys={data.keys} data={data.data} />
        : <StackedBarBody keys={data.keys} data={data.data} />;
    case 'matrix':
      return <RiskMatrix buckets={data.buckets} />;
    default:
      return <Centered>Not configured yet</Centered>;
  }
}
