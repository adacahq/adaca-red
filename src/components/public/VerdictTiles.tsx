'use client';

import { useEffect, useState } from 'react';
import Modal from '@/components/ui/Modal';
import { TONE_COLOR } from '@/lib/definitions/choices';
import type { RubricRating } from '@/lib/supabase/types';
import type { Finding, VerdictOutput } from '@/lib/workflows/types';
import type { FindingsGroup } from './ReportView';

/**
 * The verdict tiles (report `display: 'tiles'`) — four counts, each opening a
 * modal listing the affected controls by category. Client component (needs
 * click state); ReportView (a shared/sync component, safe in server trees)
 * renders this across the RSC boundary, so props are plain serializable data
 * only — mirrors FindingsTabs' {groups, findings, ratings} shape. The rating-
 * resolution logic (TILE_RATING_KEY/scoreBucket/scoreFallbackRating) lives
 * here now, not in ReportView, to avoid a second circular import between the
 * two files (FindingsCategoryBody stays the one shared piece, in ReportView).
 */

type CountKey = 'covered' | 'partial' | 'notCovered' | 'notApplicable';

/** Count key → the matching rubric_snapshot rating key, for the tile's guidance lookup. */
const TILE_RATING_KEY: Record<CountKey, string> = {
  covered: 'covered',
  partial: 'partial',
  notCovered: 'not_covered',
  notApplicable: 'not_applicable',
};

/**
 * Score → bucket, mirroring computeVerdict's per-control classification
 * EXACTLY (src/lib/workflows/verdict.ts: covered = score === maxScore,
 * partial = 0 < score < maxScore, notCovered = score 0 (non-null),
 * notApplicable = score null) — keep the two in sync if that rule ever
 * changes.
 */
function scoreBucket(score: number | null, maxScore: number): CountKey {
  if (score === null) return 'notApplicable';
  if (score >= maxScore && maxScore > 0) return 'covered';
  if (score > 0) return 'partial';
  return 'notCovered';
}

/**
 * Fallback for rubrics that don't use the conventional rating keys
 * (TILE_RATING_KEY misses): classify every rating by SCORE using the same
 * bucket rule as computeVerdict. Only trusted when exactly one rating lands
 * in the bucket — an ambiguous multi-level scale gets no guidance rather
 * than a guess.
 */
function scoreFallbackRating(countKey: CountKey, ratings: RubricRating[], maxScore: number): RubricRating | undefined {
  const matches = ratings.filter((r) => scoreBucket(r.score, maxScore) === countKey);
  return matches.length === 1 ? matches[0] : undefined;
}

/** Which bucket a control's finding falls in — a control with no finding (or
 *  an unrecognised rating key) is the zero-score bucket, same as computeVerdict. */
function controlBucket(
  controlKey: string,
  findings: Record<string, Finding>,
  ratingMeta: Map<string, RubricRating>,
  maxScore: number,
): CountKey {
  const f = findings[controlKey];
  const rating = f ? ratingMeta.get(f.rating) : undefined;
  if (f && rating && rating.score === null) return 'notApplicable';
  const score = f ? (rating?.score ?? 0) : 0;
  return scoreBucket(score, maxScore);
}

const ROWS: { countKey: CountKey; label: string; tone: string }[] = [
  { countKey: 'covered', label: 'Fully covered', tone: 'var(--ok)' },
  { countKey: 'partial', label: 'Partially covered', tone: 'var(--warn)' },
  { countKey: 'notCovered', label: 'Not covered', tone: 'var(--crit)' },
  { countKey: 'notApplicable', label: 'Not applicable', tone: 'var(--muted)' },
];

export default function VerdictTiles({
  counts,
  ratings,
  groups,
  findings,
}: {
  counts: VerdictOutput['counts'];
  ratings: RubricRating[];
  groups: FindingsGroup[];
  findings: Record<string, Finding>;
}) {
  const [openBucket, setOpenBucket] = useState<CountKey | null>(null);
  // A control key to jump to, set by a click and applied in an effect — the
  // react-hooks/immutability lint rule (React Compiler) treats a direct
  // `location.hash = …` assignment inside an event handler as an impure
  // render-scope mutation; routing it through state + an effect is its own
  // suggested fix. (Re-clicking the identical control twice in a row is a
  // no-op — the hash is already there — so there's nothing to reset here.)
  const [pendingKey, setPendingKey] = useState<string | null>(null);

  useEffect(() => {
    if (pendingKey) window.location.hash = `ctl-${pendingKey}`;
  }, [pendingKey]);

  const ratingMeta = new Map(ratings.map((r) => [r.key, r]));
  const maxScore = Math.max(0, ...ratings.map((r) => r.score ?? 0));
  const countValue: Record<CountKey, number> = {
    covered: counts.covered,
    partial: counts.partial,
    notCovered: counts.notCovered,
    notApplicable: counts.notApplicable,
  };

  const openRow = ROWS.find((r) => r.countKey === openBucket);
  const openRating = openRow
    ? (ratingMeta.get(TILE_RATING_KEY[openRow.countKey]) ?? scoreFallbackRating(openRow.countKey, ratings, maxScore))
    : undefined;
  // Controls matching the open bucket, grouped by category — only categories with ≥1 match.
  const openGroups = openBucket
    ? groups
        .map((g) => ({ group: g, controls: g.controls.filter((c) => controlBucket(c.key, findings, ratingMeta, maxScore) === openBucket) }))
        .filter((g) => g.controls.length > 0)
    : [];

  /** Close the modal and queue a jump to a control's row — not a direct
   *  scrollIntoView: the row may not be mounted yet (tabs mode only mounts
   *  the active category). FindingsTabs' hashchange listener picks up the
   *  resulting hash change, switches tabs if needed, then scrolls. */
  function goToControl(key: string) {
    setOpenBucket(null);
    setPendingKey(key);
  }

  return (
    <>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 items-start">
        {ROWS.map((r) => {
          const rating = ratingMeta.get(TILE_RATING_KEY[r.countKey]) ?? scoreFallbackRating(r.countKey, ratings, maxScore);
          const tone = rating ? TONE_COLOR[rating.tone] : r.tone;
          return (
            <button
              key={r.countKey}
              type="button"
              className="card text-left"
              style={{ position: 'relative', width: '100%', cursor: 'pointer' }}
              onClick={() => setOpenBucket(r.countKey)}
            >
              <span aria-hidden style={{ position: 'absolute', top: 14, right: 16, fontSize: 13, color: 'var(--muted)' }}>
                ↗
              </span>
              <span style={{ fontSize: 30, fontWeight: 500, color: tone, display: 'block' }}>{countValue[r.countKey]}</span>
              <span
                className="pill mt-3"
                style={{ display: 'inline-flex', color: tone, borderColor: `color-mix(in srgb, ${tone} 45%, transparent)` }}
              >
                {rating?.label ?? r.label}
              </span>
            </button>
          );
        })}
      </div>

      {openRow && (
        <Modal open onClose={() => setOpenBucket(null)} title={openRating?.label ?? openRow.label} maxWidth={560}>
          <p className="text-[15px]" style={{ color: 'var(--fg)' }}>
            {countValue[openRow.countKey]} of {counts.total} controls
          </p>
          {openRating?.guidance && (
            <p className="mt-2 text-[15px]" style={{ color: 'var(--muted)', lineHeight: 1.6 }}>
              {openRating.guidance}
            </p>
          )}
          {openGroups.length === 0 ? (
            <p className="mt-4 text-[15px]" style={{ color: 'var(--muted)' }}>No controls in this band.</p>
          ) : (
            <div className="mt-4 flex flex-col gap-4">
              {openGroups.map(({ group, controls }) => (
                <div key={group.key}>
                  <p className="mb-1.5" style={{ fontSize: 15, fontWeight: 500, color: 'var(--fg)' }}>{group.label}</p>
                  <div className="flex flex-col gap-1">
                    {controls.map((c) => (
                      <a
                        key={c.key}
                        href={`#ctl-${c.key}`}
                        className="report-toc-link"
                        style={{ fontSize: 15, color: 'var(--fg)' }}
                        onClick={(e) => {
                          e.preventDefault();
                          goToControl(c.key);
                        }}
                      >
                        {c.label}
                      </a>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Modal>
      )}
    </>
  );
}
