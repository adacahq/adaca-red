import { ReactNode } from 'react';

interface NegativeListProps {
  /** Eyebrow above the list. Pass `null` to suppress when a SectionHeader above already names the block. */
  title?: string | null;
  items: ReactNode[];
}

/**
 * "Don't" / anti-pattern list. Hairline border all around, hairline
 * separators between rows. Each item carries a small red ✗ as the only
 * colour cue.
 */
export default function NegativeList({ title = 'Avoid', items }: NegativeListProps) {
  return (
    <section
      className="my-12"
      style={{ border: '1px solid var(--line)' }}
    >
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
      <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
        {items.map((item, i) => (
          <li
            key={i}
            style={{
              padding: '12px 18px',
              margin: 0,
              borderBottom:
                i < items.length - 1 ? '1px solid var(--line)' : 'none',
              display: 'flex',
              alignItems: 'flex-start',
              gap: 12,
            }}
          >
            <span
              aria-hidden
              className="mono"
              style={{
                fontSize: 13,
                fontWeight: 500,
                color: 'var(--red)',
                lineHeight: 1.55,
                flexShrink: 0,
              }}
            >
              ✗
            </span>
            <span
              style={{
                fontSize: 14,
                color: 'var(--ink)',
                lineHeight: 1.55,
              }}
            >
              {item}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
