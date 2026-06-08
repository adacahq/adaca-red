import { ReactNode } from 'react';

export interface PricingRow {
  label: string;
  amount: string;
  unit?: string;
  note?: ReactNode;
  featured?: boolean;
}

interface PricingTableProps {
  rows: PricingRow[];
  /**
   * Eyebrow above the table. Pass `null` to suppress — useful when the
   * page h1 already names the section.
   */
  title?: string | null;
}

/**
 * Three-column pricing list — label, big amount in mono, supporting note.
 * Featured row gets an accent left bar.
 */
export default function PricingTable({ rows, title = 'Pricing' }: PricingTableProps) {
  return (
    <section className="my-8">
      {title && (
        <h3
          className="mono mb-3"
          style={{
            fontSize: 10,
            fontWeight: 500,
            letterSpacing: '0.12em',
            color: 'var(--muted)',
            textTransform: 'uppercase',
          }}
        >
          {title}
        </h3>
      )}
      <ul style={{ borderTop: '1px solid var(--line)' }}>
        {rows.map((row) => (
          <li
            key={row.label}
            className="relative grid grid-cols-1 sm:grid-cols-[220px_180px_1fr] gap-y-1 sm:gap-x-6 py-4"
            style={{ borderBottom: '1px solid var(--line)' }}
          >
            {row.featured && (
              <span
                aria-hidden
                style={{
                  position: 'absolute',
                  left: -10,
                  top: 14,
                  bottom: 14,
                  width: 2,
                  background: 'var(--accent)',
                }}
              />
            )}
            <span
              style={{
                color: 'var(--ink)',
                fontSize: 14,
                fontWeight: 500,
              }}
            >
              {row.label}
            </span>
            <span
              className="mono"
              style={{
                color: row.featured ? 'var(--accent)' : 'var(--ink)',
                fontSize: 18,
                fontWeight: 500,
                letterSpacing: '-0.01em',
              }}
            >
              {row.amount}
              {row.unit && (
                <span
                  className="mono ml-1"
                  style={{
                    fontSize: 11,
                    color: 'var(--muted-2)',
                    letterSpacing: '0.04em',
                  }}
                >
                  {row.unit}
                </span>
              )}
            </span>
            {row.note && (
              <span
                style={{
                  color: 'var(--muted)',
                  fontSize: 13,
                  lineHeight: 1.55,
                }}
              >
                {row.note}
              </span>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
