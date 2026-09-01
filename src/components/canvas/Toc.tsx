import type { MouseEvent } from 'react';

export interface TocItem {
  /** Sequential number. Auto-padded to "01", "02", … in the left column. */
  n: number;
  /** Anchor href, e.g. "#arg-01", "#obj-01", "#icp" */
  href: string;
  /** Main text of the row */
  text: string;
  /** Optional secondary tag (mono uppercase) shown between number and text. */
  tag?: string;
  /** Optional 7px tone dot shown between the number/tag and text — a status
   *  colour for the row (e.g. a rating's tone). Omit for a plain row. */
  tone?: string;
}

interface TocProps {
  /** Eyebrow label above the list. Item count is appended automatically. */
  title: string;
  items: TocItem[];
  /** Section wrapper className; default suits a standalone page section.
   *  Pass something tighter (e.g. "mb-6") when nesting inside an already-
   *  padded container, such as a tab panel. */
  className?: string;
  /** Called before default anchor navigation on an item click — call
   *  event.preventDefault() to take over (e.g. a custom smooth-scroll).
   *  Absent = plain anchor behaviour. */
  onItemClick?: (item: TocItem, event: MouseEvent<HTMLAnchorElement>) => void;
}

/**
 * The single in-page table of contents. Mono number left, optional tag,
 * optional tone dot, text, hover arrow right. Hairline rows. Prescriptive:
 * same visual register on every page. Use it whenever a section has more
 * than three jump targets.
 */
export default function Toc({ title, items, className = 'my-10', onItemClick }: TocProps) {
  return (
    <section className={className}>
      <p className="zone-label mb-3">
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
                onClick={onItemClick ? (e) => onItemClick(it, e) : undefined}
              >
                <span
                  className="mono"
                  style={{
                    fontSize: 14,
                    letterSpacing: '0.08em',
                    color: 'var(--muted)',
                    minWidth: 24,
                  }}
                >
                  {idx}
                </span>
                {it.tag && (
                  <span
                    className="mono hidden sm:inline"
                    style={{
                      fontSize: 14,
                      fontWeight: 500,
                      letterSpacing: '0.14em',
                      textTransform: 'uppercase',
                      color: 'var(--muted)',
                      minWidth: 160,
                    }}
                  >
                    {it.tag}
                  </span>
                )}
                {it.tone && (
                  <span
                    aria-hidden
                    style={{ width: 7, height: 7, borderRadius: '50%', background: it.tone, display: 'inline-block', flexShrink: 0, alignSelf: 'center' }}
                  />
                )}
                <span
                  style={{
                    color: 'var(--fg)',
                    fontSize: 15,
                    lineHeight: 1.45,
                    letterSpacing: '-0.005em',
                    flex: 1,
                  }}
                >
                  {it.text}
                </span>
                <span
                  aria-hidden
                  className="toc-row__arrow shrink-0"
                  style={{ fontSize: 13, color: 'var(--muted)', transition: 'color 0.15s ease' }}
                >
                  ↘
                </span>
              </a>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
