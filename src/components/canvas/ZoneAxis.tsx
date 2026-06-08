import { ReactNode } from 'react';

export interface Zone {
  /** Range / axis label, e.g. "< 20 staff". */
  range: string;
  /** The lead line for the zone, e.g. a persona or owner. */
  lead: string;
  /** Bullet items rendered with muted markers. Preferred for tight notes. */
  bullets?: ReactNode[];
  /** Free-form body content. Use when bullets aren't the right shape. */
  body?: ReactNode;
  /** Optional tag rendered top-right (e.g. "Sweet spot"). */
  tag?: string;
  /** Relative column weight. Use 2 to give a zone more room. */
  weight?: number;
}

interface ZoneAxisProps {
  zones: Zone[];
}

/**
 * Horizontal axis of weighted zone columns. Cells share borders only, no
 * background fills. Hairline top border, amber accents on the tag, accent
 * on the lead line, muted bullet markers. Generalised from the Adaca One
 * persona axis.
 */
export default function ZoneAxis({ zones }: ZoneAxisProps) {
  const gridCols = zones.map((z) => `${z.weight ?? 1}fr`).join(' ');
  return (
    <section className="my-12">
      <div
        className="grid"
        style={{
          gridTemplateColumns: gridCols,
          borderTop: '1px solid var(--line)',
          borderLeft: '1px solid var(--line)',
        }}
      >
        {zones.map((zone, i) => (
          <div
            key={`${zone.range}-${i}`}
            className="p-5 flex flex-col gap-3"
            style={{
              background: 'transparent',
              borderRight: '1px solid var(--line)',
              borderBottom: '1px solid var(--line)',
            }}
          >
            <div className="flex items-baseline justify-between gap-3">
              <span
                className="mono"
                style={{
                  fontSize: 10,
                  fontWeight: 500,
                  letterSpacing: '0.12em',
                  color: 'var(--muted-2)',
                  textTransform: 'uppercase',
                }}
              >
                {zone.range}
              </span>
              {zone.tag && (
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
                  }}
                >
                  {zone.tag}
                </span>
              )}
            </div>

            <p
              className="mono"
              style={{
                fontSize: 12,
                fontWeight: 500,
                letterSpacing: '0.06em',
                color: 'var(--accent)',
                textTransform: 'uppercase',
                margin: 0,
              }}
            >
              {zone.lead}
            </p>

            {zone.bullets && (
              <ul
                style={{
                  listStyle: 'none',
                  padding: 0,
                  margin: 0,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 8,
                }}
              >
                {zone.bullets.map((b, bi) => (
                  <li
                    key={bi}
                    style={{
                      margin: 0,
                      paddingLeft: 14,
                      position: 'relative',
                      fontSize: 13.5,
                      color: 'var(--ink-2)',
                      lineHeight: 1.5,
                    }}
                  >
                    <span
                      aria-hidden
                      style={{
                        position: 'absolute',
                        left: 0,
                        top: '0.55em',
                        width: 5,
                        height: 5,
                        borderRadius: '50%',
                        background: 'var(--muted-2)',
                      }}
                    />
                    {b}
                  </li>
                ))}
              </ul>
            )}

            {zone.body && !zone.bullets && (
              <div style={{ fontSize: 13.5, color: 'var(--ink-2)', lineHeight: 1.55 }}>
                {zone.body}
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
