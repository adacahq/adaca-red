import type { CSSProperties } from 'react';
import { readRed, redTotal } from '@/lib/red';

// Deterministic RED ramp (spec §9.1): R light → D deep.
const AXIS_COLORS = {
  relevance: 'var(--accent-1)',
  extent: 'var(--accent-2)',
  duration: 'var(--accent-3)',
} as const;

/** Compact read-only RED readout: R/E/D swatches, then the total on a slim
 *  `.pbar` (0–12) — the inline idiom, sized for a hairline list row. */
export default function RedScore({ data }: { data: unknown }) {
  const r = readRed(data);
  const total = redTotal(r);
  const axes: [keyof typeof AXIS_COLORS, number][] = [
    ['relevance', r.relevance],
    ['extent', r.extent],
    ['duration', r.duration],
  ];
  return (
    <span className="inline-flex items-center gap-3">
      {axes.map(([k, v]) => (
        <span key={k} className="inline-flex items-center gap-1.5">
          <span
            aria-hidden
            style={{ width: 8, height: 8, background: AXIS_COLORS[k], display: 'inline-block' }}
          />
          <span className="mono" style={{ fontSize: 11, color: 'var(--muted)' }}>
            {k[0].toUpperCase()}
            {v}
          </span>
        </span>
      ))}
      <span className="inline-flex items-center gap-2">
        <span className="pbar inline-block w-14">
          <i style={{ '--w': `${(total / 12) * 100}%`, background: 'var(--accent-2)' } as CSSProperties} />
        </span>
        <span className="mono" style={{ fontSize: 11, fontWeight: 500, color: 'var(--fg)' }}>
          {total}/12
        </span>
      </span>
    </span>
  );
}
