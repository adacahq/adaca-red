'use client';

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

export interface RedPoint {
  label: string;
  Relevance: number;
  Extent: number;
  Duration: number;
}

const COLORS = {
  Relevance: 'var(--accent-1)',
  Extent: 'var(--accent-2)',
  Duration: 'var(--accent-3)',
} as const;

const axisTick = { fontSize: 10, fontFamily: 'var(--font-mono)', fill: 'var(--muted-2)' };

export default function RedTrend({ series }: { series: RedPoint[] }) {
  if (series.length === 0) {
    return <p className="text-[13px]" style={{ color: 'var(--muted-2)' }}>No assessments yet.</p>;
  }

  return (
    <div className="my-4 grid grid-cols-1 md:grid-cols-2 gap-8">
      <div>
        <p className="field-label">Composite (0–12, stacked)</p>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={series} margin={{ top: 8, right: 8, bottom: 0, left: -20 }}>
            <CartesianGrid vertical={false} stroke="var(--line)" />
            <XAxis dataKey="label" tick={axisTick} tickLine={false} axisLine={{ stroke: 'var(--line)' }} />
            <YAxis domain={[0, 12]} ticks={[0, 4, 8, 12]} tick={axisTick} tickLine={false} axisLine={false} />
            <Tooltip
              cursor={{ fill: 'rgba(255,255,255,0.04)' }}
              contentStyle={{ fontSize: 12, background: 'var(--bg-alt)', border: '1px solid var(--line)', color: 'var(--ink)' }}
              labelStyle={{ color: 'var(--muted)' }}
            />
            <Bar dataKey="Duration" stackId="red" fill={COLORS.Duration} />
            <Bar dataKey="Extent" stackId="red" fill={COLORS.Extent} />
            <Bar dataKey="Relevance" stackId="red" fill={COLORS.Relevance} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div>
        <p className="field-label">By axis (0–4, grouped)</p>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={series} margin={{ top: 8, right: 8, bottom: 0, left: -20 }}>
            <CartesianGrid vertical={false} stroke="var(--line)" />
            <XAxis dataKey="label" tick={axisTick} tickLine={false} axisLine={{ stroke: 'var(--line)' }} />
            <YAxis domain={[0, 4]} ticks={[0, 1, 2, 3, 4]} tick={axisTick} tickLine={false} axisLine={false} />
            <Tooltip
              cursor={{ fill: 'rgba(255,255,255,0.04)' }}
              contentStyle={{ fontSize: 12, background: 'var(--bg-alt)', border: '1px solid var(--line)', color: 'var(--ink)' }}
              labelStyle={{ color: 'var(--muted)' }}
            />
            <Bar dataKey="Relevance" fill={COLORS.Relevance} />
            <Bar dataKey="Extent" fill={COLORS.Extent} />
            <Bar dataKey="Duration" fill={COLORS.Duration} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// Re-export Cell to satisfy tree-shaking edge cases in some recharts versions.
export { Cell };
