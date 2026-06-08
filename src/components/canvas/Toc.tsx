import { ArrowDownRightIcon } from '@heroicons/react/20/solid';

export interface TocItem {
  /** Sequential number. Auto-padded to "01", "02", … in the left column. */
  n: number;
  /** Anchor href, e.g. "#arg-01", "#obj-01", "#icp" */
  href: string;
  /** Main text of the row */
  text: string;
  /** Optional secondary tag (mono uppercase) shown between number and text. */
  tag?: string;
}

interface TocProps {
  /** Eyebrow label above the list. Item count is appended automatically. */
  title: string;
  items: TocItem[];
}

/**
 * The single in-page table of contents. Mono number left, optional tag,
 * text, hover arrow right. Hairline rows. Prescriptive: same visual
 * register on every page. Use it whenever a section has more than three
 * jump targets.
 */
export default function Toc({ title, items }: TocProps) {
  return (
    <section className="my-10">
      <p
        className="mono mb-3"
        style={{
          fontSize: 10,
          fontWeight: 500,
          letterSpacing: '0.14em',
          textTransform: 'uppercase',
          color: 'var(--muted-2)',
        }}
      >
        {title} · {items.length}
      </p>
      <ul
        style={{
          listStyle: 'none',
          padding: 0,
          margin: 0,
          borderTop: '1px solid var(--line)',
        }}
      >
        {items.map((it) => {
          const idx = String(it.n).padStart(2, '0');
          return (
            <li key={`${it.href}-${it.n}`} style={{ borderBottom: '1px solid var(--line)' }}>
              <a
                href={it.href}
                className="toc-row group flex items-baseline gap-4 py-3"
              >
                <span
                  className="mono"
                  style={{
                    fontSize: 10,
                    letterSpacing: '0.08em',
                    color: 'var(--muted-2)',
                    minWidth: 24,
                  }}
                >
                  {idx}
                </span>
                {it.tag && (
                  <span
                    className="mono hidden sm:inline"
                    style={{
                      fontSize: 9,
                      fontWeight: 500,
                      letterSpacing: '0.14em',
                      textTransform: 'uppercase',
                      color: 'var(--muted-2)',
                      minWidth: 160,
                    }}
                  >
                    {it.tag}
                  </span>
                )}
                <span
                  style={{
                    color: 'var(--ink)',
                    fontSize: 14,
                    lineHeight: 1.45,
                    letterSpacing: '-0.005em',
                    flex: 1,
                  }}
                >
                  {it.text}
                </span>
                <ArrowDownRightIcon
                  aria-hidden
                  className="toc-row__arrow h-3 w-3 shrink-0"
                  style={{ color: 'var(--muted-2)', transition: 'color 0.15s ease' }}
                />
              </a>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
