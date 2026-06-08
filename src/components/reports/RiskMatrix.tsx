'use client';

import { Fragment } from 'react';
import Link from 'next/link';

interface CellRisk { id: string; title: string }
interface Cell { count: number; risks: CellRisk[] }

/**
 * 5×5 likelihood × impact grid that fills the available width. Cell tint scales
 * with inherent exposure; hovering (or focusing) a populated cell reveals the
 * list of risks sitting in it, each linking to its detail page.
 */
export default function RiskMatrix({ buckets }: { buckets: Record<string, Cell> }) {
  const levels = [1, 2, 3, 4, 5];

  function tint(score: number): string {
    if (score >= 15) return 'var(--red-tint)';
    if (score >= 9) return 'var(--amber-tint)';
    if (score >= 4) return 'var(--accent-tint)';
    return 'var(--green-tint)';
  }

  return (
    <div className="my-6 w-full">
      <div className="flex gap-2">
        {/* Y axis label */}
        <div
          className="mono flex items-center justify-center"
          style={{
            writingMode: 'vertical-rl',
            transform: 'rotate(180deg)',
            fontSize: 10,
            letterSpacing: '0.14em',
            textTransform: 'uppercase',
            color: 'var(--muted-2)',
            padding: '0 2px',
          }}
        >
          Impact →
        </div>

        <div className="flex-1">
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '34px repeat(5, minmax(0, 1fr))',
              borderTop: '1px solid var(--line)',
              borderLeft: '1px solid var(--line)',
              overflow: 'visible',
            }}
          >
            {[...levels].reverse().map((impact) => (
              <Fragment key={impact}>
                {/* impact (row) label */}
                <div
                  className="mono flex items-center justify-center"
                  style={{ fontSize: 11, color: 'var(--muted-2)', borderRight: '1px solid var(--line)', borderBottom: '1px solid var(--line)' }}
                >
                  {impact}
                </div>

                {levels.map((likelihood) => {
                  const key = `${likelihood}-${impact}`;
                  const cell = buckets[key];
                  const score = likelihood * impact;
                  const has = (cell?.count ?? 0) > 0;
                  const alignRight = likelihood >= 4;
                  return (
                    <div
                      key={key}
                      className="group relative flex items-center justify-center"
                      tabIndex={has ? 0 : -1}
                      style={{
                        minHeight: 'clamp(80px, 11vh, 148px)',
                        background: tint(score),
                        borderRight: '1px solid var(--line)',
                        borderBottom: '1px solid var(--line)',
                        fontSize: 22,
                        fontWeight: 500,
                        color: has ? 'var(--ink)' : 'var(--muted-2)',
                        cursor: has ? 'pointer' : 'default',
                        outline: 'none',
                      }}
                    >
                      {cell?.count ?? 0}

                      {has && (
                        <div
                          className="pointer-events-none opacity-0 transition-opacity duration-100 group-hover:pointer-events-auto group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:opacity-100"
                          style={{
                            position: 'absolute',
                            top: '100%',
                            left: alignRight ? undefined : 0,
                            right: alignRight ? 0 : undefined,
                            marginTop: 2,
                            zIndex: 50,
                            width: 'max-content',
                            minWidth: 200,
                            maxWidth: 300,
                            maxHeight: 240,
                            overflowY: 'auto',
                            background: 'var(--bg-elev)',
                            border: '1px solid var(--line-strong)',
                          }}
                        >
                          <div
                            className="mono flex items-center justify-between"
                            style={{
                              fontSize: 9,
                              letterSpacing: '0.1em',
                              textTransform: 'uppercase',
                              color: 'var(--muted-2)',
                              padding: '8px 12px',
                              borderBottom: '1px solid var(--line)',
                              background: 'var(--bg-alt)',
                            }}
                          >
                            <span>L{likelihood} · I{impact}</span>
                            <span>{cell.count} risk{cell.count === 1 ? '' : 's'}</span>
                          </div>
                          <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                            {cell.risks.map((r) => (
                              <li key={r.id} style={{ borderBottom: '1px solid var(--line)' }}>
                                <Link
                                  href={`/risks/${r.id}`}
                                  className="text-link block"
                                  style={{ fontSize: 13, fontWeight: 400, padding: '8px 12px', lineHeight: 1.4 }}
                                >
                                  {r.title}
                                </Link>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  );
                })}
              </Fragment>
            ))}

            {/* bottom likelihood-label row */}
            <div style={{ borderRight: '1px solid var(--line)', borderBottom: '1px solid var(--line)' }} />
            {levels.map((l) => (
              <div
                key={l}
                className="mono flex items-center justify-center"
                style={{ height: 24, fontSize: 11, color: 'var(--muted-2)', borderRight: '1px solid var(--line)', borderBottom: '1px solid var(--line)' }}
              >
                {l}
              </div>
            ))}
          </div>

          <p
            className="mono mt-2 text-center"
            style={{ fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--muted-2)' }}
          >
            Likelihood →
          </p>
        </div>
      </div>
    </div>
  );
}
