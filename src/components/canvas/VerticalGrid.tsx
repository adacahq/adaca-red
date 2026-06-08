import { ReactNode } from 'react';

export interface VerticalCell {
  number: string;
  name: string;
  description?: ReactNode;
  /** Featured cells get an accent bar and bolder typographic emphasis */
  featured?: boolean;
  /** Optional short tag rendered top-right (e.g. "Our biggest") */
  tag?: string;
}

interface VerticalGridProps {
  cells: VerticalCell[];
}

/**
 * Stacked list of full-width cells. Featured cells get an accent left bar
 * and a slightly larger title. Borders only, no background fills.
 */
export default function VerticalGrid({ cells }: VerticalGridProps) {
  return (
    <section
      className="my-12"
      style={{ borderTop: '1px solid var(--line)' }}
    >
      {cells.map((cell) => (
        <article
          key={cell.number}
          className="relative p-6 flex flex-col gap-3"
          style={{
            background: 'transparent',
            borderBottom: '1px solid var(--line)',
          }}
        >
          {cell.featured && (
            <span
              aria-hidden
              style={{
                position: 'absolute',
                left: 0,
                top: 0,
                bottom: 0,
                width: 2,
                background: 'var(--accent)',
              }}
            />
          )}

          <div className="flex items-baseline justify-between gap-4">
            <div className="flex items-baseline gap-4">
              <span
                className="mono"
                style={{
                  fontSize: 11,
                  fontWeight: 500,
                  letterSpacing: '0.08em',
                  color: cell.featured ? 'var(--accent)' : 'var(--muted-2)',
                  minWidth: 24,
                }}
              >
                {cell.number}
              </span>
              <h3
                style={{
                  fontSize: cell.featured ? 20 : 17,
                  fontWeight: 500,
                  color: 'var(--ink)',
                  letterSpacing: '-0.005em',
                  margin: 0,
                }}
              >
                {cell.name}
              </h3>
            </div>
            {cell.tag && (
              <span
                className="mono"
                style={{
                  fontSize: 9,
                  fontWeight: 500,
                  letterSpacing: '0.14em',
                  color: 'var(--amber)',
                  textTransform: 'uppercase',
                  padding: '3px 8px',
                  border: '1px solid var(--amber)',
                  flexShrink: 0,
                }}
              >
                {cell.tag}
              </span>
            )}
          </div>

          {cell.description && (
            <p
              style={{
                fontSize: 14,
                color: 'var(--muted)',
                lineHeight: 1.6,
                margin: 0,
                paddingLeft: 40,
              }}
            >
              {cell.description}
            </p>
          )}
        </article>
      ))}
    </section>
  );
}
