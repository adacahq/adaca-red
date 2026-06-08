import { ReactNode } from 'react';

export interface NavigateItem {
  /** The situation as encountered. Rendered as the line title. */
  situation: ReactNode;
  /** The recommended angle or action. Rendered as the muted line below. */
  angle: ReactNode;
}

interface NavigateListProps {
  /**
   * Eyebrow above the list. Pass `null` to suppress when a SectionHeader
   * already names the block above.
   */
  title?: string | null;
  items: NavigateItem[];
}

/**
 * Two-line rows: a bold situation title with a muted recommended-angle
 * line beneath. Hairline border all around the block, hairline separators
 * between rows.
 */
export default function NavigateList({
  title = 'Situations to navigate',
  items,
}: NavigateListProps) {
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
              padding: '14px 18px',
              margin: 0,
              borderBottom:
                i < items.length - 1 ? '1px solid var(--line)' : 'none',
            }}
          >
            <p
              style={{
                fontSize: 14,
                fontWeight: 500,
                color: 'var(--ink)',
                lineHeight: 1.5,
                margin: 0,
              }}
            >
              {item.situation}
            </p>
            <p
              style={{
                fontSize: 13.5,
                color: 'var(--muted)',
                lineHeight: 1.6,
                margin: '4px 0 0',
              }}
            >
              {item.angle}
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}
