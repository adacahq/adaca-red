import type { AssessOutput, Finding } from './types';

/**
 * Flatten helpers for the assess step's output — pure, unit-tested in
 * isolation from steps.ts (which pulls in Supabase/Anthropic/email). Every
 * reader of assess findings/summaries goes through these instead of poking
 * `AssessOutput.findings`/`.byPrinciple` directly, so a run caught mid-deploy
 * (some principles completed under the old flat writer, others under the new
 * byPrinciple one — see AssessOutput's doc comment in types.ts) is handled
 * once, here, rather than at every call site.
 */

/** Control key → finding, merging legacy flat `findings` with `byPrinciple`. */
export function assessFindings(assess: AssessOutput | undefined): Record<string, Finding> {
  const out: Record<string, Finding> = { ...(assess?.findings ?? {}) };
  for (const principle of Object.values(assess?.byPrinciple ?? {})) {
    Object.assign(out, principle.findings);
  }
  return out;
}

/** Principle key → "what this means for you" summary; empty for legacy (pre-summary) runs. */
export function assessSummaries(assess: AssessOutput | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, principle] of Object.entries(assess?.byPrinciple ?? {})) {
    if (principle.summary) out[key] = principle.summary;
  }
  return out;
}
