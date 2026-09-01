import type { RubricConfig } from '@/lib/supabase/types';
import { assessFindings } from './assessOutput';
import type { AssessOutput, VerdictOutput } from './types';

/**
 * Verdict computation — pure code, no LLM (docs/workflow-forms-plan.md §7.2).
 *
 * Coverage = Σ(weight × rating score) / Σ(weight × max score), over all
 * controls whose rating carries a numeric score. Ratings with score:null
 * (not_applicable) drop out of BOTH sides; a control with NO finding counts as
 * zero — unassessed is not a pass. Thresholds map the ratio to Green/Amber/Red.
 */

export function computeVerdict(
  rubric: RubricConfig,
  assess: AssessOutput,
  thresholds: { green: number; amber: number },
  documentNames: string[],
): VerdictOutput {
  const scoreByRating = new Map(rubric.ratings.map((r) => [r.key, r.score]));
  const maxScore = Math.max(0, ...rubric.ratings.map((r) => r.score ?? 0));
  // Tolerates legacy flat `findings`, current `byPrinciple`, or (mid-deploy)
  // both — see AssessOutput's doc comment in types.ts.
  const findings = assessFindings(assess);

  let num = 0;
  let den = 0;
  const counts = { covered: 0, partial: 0, notCovered: 0, notApplicable: 0, total: 0 };

  for (const principle of rubric.principles) {
    for (const control of principle.controls) {
      counts.total += 1;
      const weight = control.weight ?? 1;
      const finding = findings[control.key];
      const score = finding ? scoreByRating.get(finding.rating) : 0;

      if (finding && score === null) {
        counts.notApplicable += 1;
        continue; // excluded from both sides
      }
      const s = score ?? 0;
      num += weight * s;
      den += weight * maxScore;
      if (s >= maxScore && maxScore > 0) counts.covered += 1;
      else if (s > 0) counts.partial += 1;
      else counts.notCovered += 1;
    }
  }

  const coverage = den > 0 ? num / den : 0;
  const verdict: VerdictOutput['verdict'] =
    coverage >= thresholds.green ? 'green' : coverage >= thresholds.amber ? 'amber' : 'red';

  return { verdict, coverage, counts, docsLine: docsLine(documentNames, counts) };
}

function docsLine(documentNames: string[], counts: VerdictOutput['counts']): string {
  const n = documentNames.length;
  const docs =
    n === 0
      ? 'no documents'
      : `${n} document${n === 1 ? '' : 's'} (${documentNames.join(', ')})`;
  const applicable = counts.total - counts.notApplicable;
  return (
    `Based on ${docs}. Of ${applicable} applicable controls, ` +
    `${counts.covered} fully covered, ${counts.partial} partially covered and ` +
    `${counts.notCovered} not covered` +
    (counts.notApplicable > 0 ? ` (${counts.notApplicable} not applicable)` : '') +
    '.'
  );
}
