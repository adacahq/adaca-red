import { ReactNode } from 'react';

interface StatBandProps {
  /** One ReactNode per cell. Bolded values inside the node (via `<strong>`) carry the emphasis. */
  items: ReactNode[];
}

/**
 * Equal-width stat band. Each cell is a single line of text with bolded
 * value inline. Hairline borders form a continuous frame. More visual
 * presence than inline prose, lighter than `HeadlineMetrics`.
 */
export default function StatBand({ items }: StatBandProps) {
  return (
    <section
      className="my-6 grid grid-cols-1 sm:grid-cols-3"
      style={{
        borderTop: '1px solid var(--line)',
        borderLeft: '1px solid var(--line)',
      }}
    >
      {items.map((item, i) => (
        <div
          key={i}
          className="px-5 py-4 text-center"
          style={{
            borderRight: '1px solid var(--line)',
            borderBottom: '1px solid var(--line)',
            fontSize: 14,
            color: 'var(--ink)',
            lineHeight: 1.5,
          }}
        >
          {item}
        </div>
      ))}
    </section>
  );
}
