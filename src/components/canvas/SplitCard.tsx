import { ReactNode } from 'react';

interface SplitCardProps {
  /** Sequential card number (01, 02, …) */
  n: number;
  /** Short label categorising the card, e.g. "Risk", "Pricing" */
  tag?: string;
  /** Mono uppercase eyebrow above the quote. Defaults to "Quote". */
  quoteLabel?: string;
  /** The headline quote, rendered at editorial size between quotation marks. */
  quote: string;
  /** Two slot children: <SplitNote> and <SplitResponse> */
  children: ReactNode;
}

/**
 * Editorial split card. A single thin accent left-bar (the only accent
 * moment), a quiet mono header, a headline quote at large size, then a
 * two-column Note + Response body. Cards are separated by generous top
 * margin. Generalised from the Adaca One objection card.
 */
export default function SplitCard({
  n,
  tag,
  quoteLabel = 'Quote',
  quote,
  children,
}: SplitCardProps) {
  const idx = String(n).padStart(2, '0');
  const anchor = `split-${idx}`;

  return (
    <article
      id={anchor}
      className="scroll-mt-20"
      style={{
        marginTop: 96,
        paddingLeft: 24,
        borderLeft: '2px solid var(--accent)',
      }}
    >
      <header className="flex items-baseline gap-4 mb-8">
        <a
          href={`#${anchor}`}
          className="mono"
          style={{
            fontSize: 11,
            fontWeight: 500,
            letterSpacing: '0.10em',
            color: 'var(--ink)',
          }}
        >
          {idx}
        </a>
        {tag && (
          <span
            className="mono"
            style={{
              fontSize: 10,
              fontWeight: 500,
              letterSpacing: '0.14em',
              textTransform: 'uppercase',
              color: 'var(--muted-2)',
            }}
          >
            {tag}
          </span>
        )}
        <span aria-hidden style={{ flex: 1, height: 1, background: 'var(--line)' }} />
      </header>

      <div className="mb-12">
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
          {quoteLabel}
        </p>
        <blockquote
          style={{
            margin: 0,
            padding: 0,
            background: 'transparent',
            border: 'none',
            color: 'var(--ink)',
            fontSize: 24,
            lineHeight: 1.3,
            fontWeight: 500,
            letterSpacing: '-0.018em',
            maxWidth: '38ch',
          }}
        >
          &ldquo;{quote}&rdquo;
        </blockquote>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-[minmax(0,38fr)_minmax(0,62fr)] gap-x-10 gap-y-10">
        {children}
      </div>
    </article>
  );
}

interface SlotProps {
  /** Override the mono eyebrow on the left of the slot label. */
  label?: string;
  /** Override the muted subtitle after the middot. */
  sublabel?: string;
  children: ReactNode;
}

/**
 * Context slot. Muted, narrower column. Framing the reader absorbs —
 * not the headline language.
 */
export function SplitNote({ label = 'Note', sublabel = 'context', children }: SlotProps) {
  return (
    <section>
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
        {label}
        <span style={{ color: 'var(--line-strong)', margin: '0 8px' }}>·</span>
        <span style={{ letterSpacing: '0.06em' }}>{sublabel}</span>
      </p>
      <div className="split-prose split-prose--note">{children}</div>
    </section>
  );
}

/**
 * Primary slot. Ink column, wider. Visually paired with the Note column
 * via the parent grid; no internal accent — restraint is the point.
 */
export function SplitResponse({ label = 'Response', sublabel = 'the line', children }: SlotProps) {
  return (
    <section>
      <p
        className="mono mb-3"
        style={{
          fontSize: 10,
          fontWeight: 500,
          letterSpacing: '0.14em',
          textTransform: 'uppercase',
          color: 'var(--ink)',
        }}
      >
        {label}
        <span style={{ color: 'var(--line-strong)', margin: '0 8px' }}>·</span>
        <span style={{ letterSpacing: '0.06em', color: 'var(--muted)' }}>{sublabel}</span>
      </p>
      <div className="split-prose split-prose--response">{children}</div>
    </section>
  );
}
