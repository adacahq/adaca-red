import { ReactNode } from 'react';

export interface CompareRow {
  /** Row label (first column). */
  label: string;
  /** Highlighted value (accent column). */
  highlight: ReactNode;
  /** Baseline / comparison value (muted column). */
  baseline: ReactNode;
}

interface CompareTableProps {
  rows: CompareRow[];
  /** Header for the label column. */
  labelHeader?: string;
  /** Header for the highlighted (accent-tinted) column. */
  highlightHeader: string;
  /** Header for the baseline (muted) column. */
  baselineHeader: string;
}

/**
 * Three-column comparison table. The highlighted column carries an accent
 * tint header and accent-ink values; the baseline column stays muted.
 * Generalised from the Adaca One seniority-bands table.
 */
export default function CompareTable({
  rows,
  labelHeader = '',
  highlightHeader,
  baselineHeader,
}: CompareTableProps) {
  const th = {
    fontSize: 10,
    letterSpacing: '0.06em',
    textTransform: 'uppercase' as const,
    padding: '10px 14px',
    borderBottom: '1px solid var(--line)',
  };
  return (
    <table className="w-full text-[14px] my-6" style={{ borderCollapse: 'collapse' }}>
      <thead>
        <tr>
          <th
            className="mono text-left"
            style={{ ...th, color: 'var(--muted)', background: 'var(--bg-alt)' }}
          >
            {labelHeader}
          </th>
          <th
            className="mono text-left"
            style={{ ...th, color: 'var(--accent)', background: 'var(--accent-tint)' }}
          >
            {highlightHeader}
          </th>
          <th
            className="mono text-left"
            style={{ ...th, color: 'var(--muted)', background: 'var(--bg-alt)' }}
          >
            {baselineHeader}
          </th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.label}>
            <td
              style={{
                padding: '12px 14px',
                borderBottom: '1px solid var(--line)',
                fontWeight: 500,
                color: 'var(--ink)',
              }}
            >
              {r.label}
            </td>
            <td
              style={{
                padding: '12px 14px',
                borderBottom: '1px solid var(--line)',
                color: 'var(--accent)',
              }}
            >
              {r.highlight}
            </td>
            <td
              style={{
                padding: '12px 14px',
                borderBottom: '1px solid var(--line)',
                color: 'var(--muted)',
              }}
            >
              {r.baseline}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
