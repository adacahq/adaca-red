import { Fragment } from 'react';
import Link from 'next/link';
import { tip } from '@/lib/tip';

interface CellRisk { id: string; title: string }
interface Cell { count: number; risks: CellRisk[] }

const LEVELS = [1, 2, 3, 4, 5];
/** How many risk titles a populated cell's tooltip lists before it truncates. */
const TIP_MAX = 6;

function tint(score: number): string | undefined {
  if (score >= 15) return 'var(--crit-tint)';
  if (score >= 9) return 'var(--warn-tint)';
  if (score >= 4) return 'var(--accent-tint)';
  return undefined;
}

/**
 * 5×5 likelihood × impact grid on the `.riskheat`/`.rh` idiom. Cell tint
 * scales with inherent exposure (likelihood × impact); a populated cell
 * carries the risks sitting in it as a `data-tip` readout (hover or keyboard
 * focus) via the shared VizTip plate — no client JS needed here.
 */
export default function RiskMatrix({ buckets }: { buckets: Record<string, Cell> }) {
  return (
    <div className="my-6 flex items-start gap-3">
      <span
        aria-hidden
        className="zone-label"
        style={{
          writingMode: 'vertical-rl',
          transform: 'rotate(180deg)',
          display: 'flex',
          alignItems: 'center',
        }}
      >
        Impact ↑
      </span>

      <div>
        <div className="riskheat">
          <span className="rhaxis" aria-hidden />
          {LEVELS.map((l) => (
            <span key={l} className="rhaxis">{l}</span>
          ))}

          {[...LEVELS].reverse().map((impact) => (
            <Fragment key={impact}>
              <span className="rhaxis rhy">{impact}</span>
              {LEVELS.map((likelihood) => {
                const key = `${likelihood}-${impact}`;
                const cell = buckets[key];
                const count = cell?.count ?? 0;
                const has = count > 0;
                const score = likelihood * impact;
                if (!has) {
                  return (
                    <span
                      key={key}
                      className="rh"
                      style={{ background: tint(score), color: 'var(--muted)' }}
                    >
                      {count}
                    </span>
                  );
                }
                // A populated cell is a real link into the register, filtered
                // to exactly this bucket — listNodes turns any search param
                // into a `data->>key` match, so likelihood/impact work as-is.
                // The tooltip says what is in the cell; the link is how you
                // get to it. (The previous bespoke hover panel carried the
                // links; keeping them here is what stops this being a
                // read-only picture.)
                return (
                  <Link
                    key={key}
                    href={`/risks?likelihood=${likelihood}&impact=${impact}`}
                    className="rh"
                    style={{ background: tint(score) }}
                    aria-label={`${count} risk${count === 1 ? '' : 's'} at likelihood ${likelihood}, impact ${impact}`}
                    data-tip={tip({
                      k: `L${likelihood} × I${impact} · ${count} risk${count === 1 ? '' : 's'}`,
                      rows: cell!.risks.slice(0, TIP_MAX).map((r) => ({ v: r.title })),
                      n:
                        cell!.risks.length > TIP_MAX
                          ? `+${cell!.risks.length - TIP_MAX} more`
                          : undefined,
                    })}
                  >
                    {count}
                  </Link>
                );
              })}
            </Fragment>
          ))}
        </div>

        <p className="zone-label mt-3" style={{ textAlign: 'center' }}>Likelihood →</p>
      </div>
    </div>
  );
}
