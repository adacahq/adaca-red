import { ReactNode } from 'react';

export interface Trigger {
  category: string;
  text: ReactNode;
}

interface TriggerGridProps {
  triggers: Trigger[];
  /** Optional title for the grid */
  title?: string;
}

/**
 * Chip-card grid. Each chip has a mono uppercase category eyebrow and a
 * phrase. Cells share borders only — no background fills. Container has
 * top + left borders; each cell carries right + bottom internal lines.
 */
export default function TriggerGrid({ triggers, title }: TriggerGridProps) {
  return (
    <section className="my-12">
      {title && (
        <p
          className="mono mb-4"
          style={{
            fontSize: 10,
            fontWeight: 500,
            letterSpacing: '0.12em',
            color: 'var(--muted)',
            textTransform: 'uppercase',
          }}
        >
          {title}
        </p>
      )}
      <ul
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3"
        style={{
          borderTop: '1px solid var(--line)',
          borderLeft: '1px solid var(--line)',
        }}
      >
        {triggers.map((t, i) => (
          <li
            key={`${t.category}-${i}`}
            className="p-5 flex flex-col gap-2"
            style={{
              background: 'transparent',
              borderRight: '1px solid var(--line)',
              borderBottom: '1px solid var(--line)',
            }}
          >
            <span
              className="mono"
              style={{
                fontSize: 10,
                fontWeight: 500,
                letterSpacing: '0.14em',
                color: 'var(--accent)',
                textTransform: 'uppercase',
              }}
            >
              {t.category}
            </span>
            <p
              style={{
                fontSize: 14,
                color: 'var(--ink)',
                lineHeight: 1.5,
                margin: 0,
              }}
            >
              {t.text}
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}
