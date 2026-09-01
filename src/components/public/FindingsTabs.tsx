'use client';

import { useEffect, useState } from 'react';
import { TONE_COLOR } from '@/lib/definitions/choices';
import type { RubricRating } from '@/lib/supabase/types';
import type { Finding } from '@/lib/workflows/types';
import { FindingsCategoryBody, type FindingsGroup } from './ReportView';

/**
 * One tab per rubric principle for the findings section (report
 * `display: 'tabs'`) — an alternative to the stacked FindingsSection for
 * long reports (many principles × controls). ReportView is a shared/sync
 * component that can render in a server tree; this file is the client
 * boundary, so its props are plain serializable data only (no functions, no
 * Maps) — anything derived (the rating lookup map) is built locally here.
 */
export default function FindingsTabs({
  groups,
  findings,
  summaries,
  ratings,
  showControlIds = true,
  showSummaries = false,
}: {
  groups: FindingsGroup[];
  findings: Record<string, Finding>;
  summaries: Record<string, string>;
  ratings: RubricRating[];
  showControlIds?: boolean;
  showSummaries?: boolean;
}) {
  const [active, setActive] = useState(groups[0]?.key ?? '');
  const current = groups.find((g) => g.key === active) ?? groups[0];

  // Deep-linked / cross-tab anchors: a #ctl-<key> hash can point at a control
  // in a group that isn't the active tab (typed in directly, or set by the
  // verdict tiles' modal — it only sets location.hash, since it can't assume
  // the row is mounted). Switch to the owning tab on mount and whenever the
  // hash changes; the effect below does the actual scroll once that tab's
  // rows exist.
  useEffect(() => {
    function syncFromHash() {
      const hash = window.location.hash;
      if (!hash.startsWith('#ctl-')) return;
      const key = hash.slice('#ctl-'.length);
      const owner = groups.find((g) => g.controls.some((c) => c.key === key));
      if (owner) setActive(owner.key);
    }
    syncFromHash();
    window.addEventListener('hashchange', syncFromHash);
    return () => window.removeEventListener('hashchange', syncFromHash);
  }, [groups]);

  // Runs after every tab switch (including the one syncFromHash triggers) —
  // if the current hash's control is in the NOW-active group, scroll to its
  // row. rAF gives the panel a frame to paint the newly-active group's rows.
  useEffect(() => {
    if (!current) return; // groups is empty — nothing to scroll to
    const hash = window.location.hash;
    if (!hash.startsWith('#ctl-')) return;
    const key = hash.slice('#ctl-'.length);
    if (!current.controls.some((c) => c.key === key)) return;
    const raf = requestAnimationFrame(() => {
      const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;
      document.getElementById(`ctl-${key}`)?.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
    });
    return () => cancelAnimationFrame(raf);
  }, [active, current]);

  if (groups.length === 0) return null;

  const ratingMeta = new Map(ratings.map((r) => [r.key, r]));

  return (
    <div>
      {/* The shared `.tabs` rail: scrolls sideways past the edge rather than
          wrapping — the same idiom every other tab strip in the app uses. */}
      <div className="tabs" role="tablist">
        {groups.map((g) => {
          const on = g.key === current.key;
          const tone = worstTone(g, findings, ratingMeta, ratings);
          return (
            <button
              key={g.key}
              type="button"
              role="tab"
              aria-selected={on}
              onClick={() => setActive(g.key)}
              className={`flex items-center gap-1.5${on ? ' active' : ''}`}
            >
              <span aria-hidden style={{ width: 7, height: 7, borderRadius: '50%', background: tone, display: 'inline-block' }} />
              {g.label}
            </button>
          );
        })}
      </div>
      <div role="tabpanel" className="tab-panel">
        <FindingsCategoryBody
          group={current}
          findings={findings}
          summaries={summaries}
          ratingMeta={ratingMeta}
          showControlIds={showControlIds}
          showSummaries={showSummaries}
          showToc
        />
      </div>
    </div>
  );
}

/**
 * A category's worst rating tone: the lowest-scored non-null rating present
 * among its findings — a control with no finding counts as the zero-score
 * bucket, and every control not_applicable (or an empty category) reports
 * neutral, since there's no worse signal to show. Scores resolve via the
 * `ratings` array, the same source of truth computeVerdict uses
 * (src/lib/workflows/verdict.ts) to bucket findings.
 */
function worstTone(
  group: FindingsGroup,
  findings: Record<string, Finding>,
  ratingMeta: Map<string, RubricRating>,
  ratings: RubricRating[],
): string {
  let worstScore: number | null = null;
  for (const c of group.controls) {
    const f = findings[c.key];
    const rating = f ? ratingMeta.get(f.rating) : undefined;
    if (f && rating && rating.score === null) continue; // genuinely not_applicable — excluded
    const score = f ? (rating?.score ?? 0) : 0; // no finding, or an unrecognised rating key, is the zero-score bucket
    if (worstScore === null || score < worstScore) worstScore = score;
  }
  if (worstScore === null) return TONE_COLOR.neutral;
  const worstRating = ratings.find((r) => r.score === worstScore);
  return worstRating ? TONE_COLOR[worstRating.tone] : TONE_COLOR.neutral;
}
