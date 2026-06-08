import { ReactNode } from 'react';

export interface KeyFactsItem {
  label: string;
  value: ReactNode;
}

interface KeyFactsProps {
  /** Optional eyebrow label rendered above the rows */
  title?: string | null;
  items: KeyFactsItem[];
}

/**
 * Two-column definition list. Label column is mono-uppercase muted, values
 * are normal-weight ink. Hairline border all around the block, hairline
 * separators between rows.
 */
export default function KeyFacts({ title, items }: KeyFactsProps) {
  return (
    <section className="my-8" style={{ border: '1px solid var(--line)' }}>
      {title && (
        <p
          className="mono"
          style={{
            fontSize: 10,
            fontWeight: 500,
            letterSpacing: '0.14em',
            color: 'var(--muted-2)',
            textTransform: 'uppercase',
            padding: '14px 18px',
            margin: 0,
            borderBottom: '1px solid var(--line)',
          }}
        >
          {title}
        </p>
      )}
      <dl
        className="grid grid-cols-1 sm:grid-cols-[200px_1fr]"
        style={{ margin: 0 }}
      >
        {items.map((item, i) => {
          const isLast = i === items.length - 1;
          const rowBorder = isLast ? 'none' : '1px solid var(--line)';
          return (
            <div key={`${item.label}-${i}`} className="contents">
              <dt
                className="mono"
                style={{
                  fontSize: 11,
                  fontWeight: 500,
                  letterSpacing: '0.06em',
                  color: 'var(--muted)',
                  textTransform: 'uppercase',
                  padding: '14px 18px',
                  margin: 0,
                  borderBottom: rowBorder,
                }}
              >
                {item.label}
              </dt>
              <dd
                style={{
                  fontSize: 14,
                  color: 'var(--ink)',
                  lineHeight: 1.55,
                  padding: '14px 18px',
                  margin: 0,
                  borderBottom: rowBorder,
                }}
              >
                {item.value}
              </dd>
            </div>
          );
        })}
      </dl>
    </section>
  );
}
