import type { RubricConfig, WorkflowConfig } from '@/lib/supabase/types';

/**
 * Workflow run state — lives on the submission node's `data.run`.
 *
 * Execution model (docs/workflow-forms-plan.md §7.3, revised for parallel
 * units): steps stay a sequential BARRIER (`stepIndex`), but the sub-units
 * WITHIN a step — the per-principle assess calls, the per-section report
 * calls — now execute concurrently. `done`/`claims` are a per-step ledger,
 * keyed by stringified sub-index, reset to `{}` at every step transition;
 * they replace the old single (stepIndex, subIndex) cursor + claim. Each
 * unit's output is written atomically to its own jsonb slot (see the
 * 20260718090000 migration) instead of a whole-node `save_node` persist,
 * which cannot coexist with concurrent writers (last-writer-wins would
 * clobber sibling outputs — the bug this replaces). The status page pumps
 * units while the submitter waits; the cron sweeps up abandoned runs. No
 * waitUntil dependency, works identically in dev and on Workers.
 */

export type RunStatus = 'pending' | 'running' | 'done' | 'failed';

export interface RunState {
  status: RunStatus;
  workflow: string;
  /** Index into workflow.steps. */
  stepIndex: number;
  startedAt: string;
  finishedAt?: string;
  error?: string;
  /** Outputs keyed by step type ('assess', 'verdict', …). */
  steps: Record<string, unknown>;
  /**
   * Sub-indexes of the CURRENT step that have completed, keyed by their
   * stringified sub-index ("0", "1", …). Reset to `{}` at each step
   * transition (`advance_run_step`). `initialRunState` seeds this `{}` (not
   * absent) so the very first claim on a fresh run has a jsonb parent to
   * write into — see the migration header for why that matters.
   */
  done?: Record<string, true>;
  /**
   * Live per-sub-index claims for the CURRENT step, written by
   * `claim_run_unit`. Ephemeral scheduling markers, not domain history —
   * reset to `{}` at each step transition, same as `done`.
   */
  claims?: Record<string, { token: string; at: string }>;
  /**
   * Per-sub-index count of transient (retryable) release cycles for the
   * CURRENT step, written by `release_run_unit` — a 529/429/5xx/network
   * error releases the claim instead of failing the run outright, up to a
   * cap (see `TRANSIENT_RETRY_MAX` in runner.ts). Reset to `{}` at each step
   * transition, same as `done`/`claims`.
   */
  retries?: Record<string, number>;
  /**
   * How many times the cron sweep (`runSweep`, src/lib/purge/run.ts) has
   * revived this run after a transient terminal failure (all sub-retries
   * exhausted). Capped independently of `retries` — persists across step
   * transitions and is NOT reset by `advance_run_step`, unlike `retries`.
   */
  cronRetries?: number;
}

export interface Finding {
  control: string;
  rating: string;
  rationale: string;
  quotes: { document: string; quote: string }[];
}

/**
 * One assess sub-unit's output — everything for ONE principle. The in-flight
 * `run.steps.assess` shape is `{ byPrinciple: Record<principleKey, …> }`:
 * each concurrent unit owns exactly its own principle key, so the shallow
 * `complete_run_unit` merge (`existing || output` at one slot) can never
 * clobber a sibling's findings — the same owned-key pattern as
 * ReportRunOutput. (A flat shared `findings` map + a shared `summaries` map
 * would race: `||` is shallow, last unit wins the whole key.)
 */
export interface PrincipleAssessOutput {
  /** control key → finding, for this principle's controls only. */
  findings: Record<string, Finding>;
  /** Plain-language "what this means for you" for this principle. */
  summary?: string;
}

/** Legacy flat shape (pre-summaries runs); readers must accept both. */
export interface AssessOutput {
  /** control key → finding. */
  findings?: Record<string, Finding>;
  byPrinciple?: Record<string, PrincipleAssessOutput>;
}

export interface CoherenceOutput {
  contradictions: { documents: string[]; description: string }[];
  paper_vs_practice: string;
  summary: string;
}

export interface VerdictOutput {
  verdict: 'green' | 'amber' | 'red';
  /** Weighted coverage ratio over applicable controls, 0..1. */
  coverage: number;
  counts: { covered: number; partial: number; notCovered: number; notApplicable: number; total: number };
  /** "Based on N documents … " line for the report + email. */
  docsLine: string;
}

export type ReportSectionOutput = {
  key: string;
  title: string;
  /**
   * Presentation flags, snapshotted from the section's live config at
   * REPORT-BUILD time (steps.ts's `runReport`) — the report page never reads
   * workflow config live. A report renders standalone forever (it must
   * outlive its submission and survive the workflow's own config changing
   * underneath it): an assessment built before a section's display/
   * showControlIds/showSummaries/collapsed changes keeps rendering exactly
   * as it always has; only assessments built AFTER the change pick up the
   * new flags. Absent on every pre-existing assessment (deploy ≠ change).
   */
  display?: 'inline' | 'tiles' | 'tabs';
  showControlIds?: boolean;
  showSummaries?: boolean;
  collapsed?: boolean;
} & (
  | { kind: 'verdict' }
  | { kind: 'findings' }
  | { kind: 'coherence' }
  | { kind: 'prose'; markdown: string }
);

/**
 * The assessment node's STORED/final report shape (ordered, per the
 * workflow's section config) — unchanged by parallel units. Read by
 * ReportView.
 */
export interface ReportOutput {
  sections: ReportSectionOutput[];
}

/**
 * The IN-FLIGHT `run.steps.report` shape while the report step is running:
 * section key → built section. Each report sub-unit owns exactly its own
 * key, so concurrent sections merge into this map without clobbering each
 * other. `runNotify` assembles the final ordered `ReportOutput` from this
 * map (workflow config order) only once the step barrier closes.
 */
export type ReportRunOutput = Record<string, ReportSectionOutput>;

export interface NotifyOutput {
  assessmentId: string;
  reportToken: string;
  emailedTo?: string;
}

/** What the public status endpoint returns per poll. */
export interface RunProgress {
  status: RunStatus;
  /** 0..1, coarse (unit-level). */
  progress: number;
  stepLabel: string;
  reportToken?: string;
  error?: string;
  /** Current step index into workflow.steps (drives the stage list). */
  stepIndex?: number;
  /** Total steps in the workflow. */
  stepCount?: number;
  /** Sub-units completed within the current step (size of run.done). */
  subDone?: number;
  /** Total sub-units in the current step. */
  subTotal?: number;
  /**
   * Whether THIS call actually claimed and ran a unit (false = nothing was
   * claimable — another pumper is live, or the run just finished/failed).
   * Drives the client's poll pacing (RunStatus) and the cron pump loop's
   * early-exit (purge/run.ts). Absent from `getRunProgress` (a pure read).
   */
  executed?: boolean;
}

export const STEP_LABELS: Record<WorkflowConfig['steps'][number]['type'], string> = {
  extract: 'Reading your documents',
  assess: 'Assessing against the standard',
  coherence: 'Checking for gaps and contradictions',
  verdict: 'Weighing the verdict',
  report: 'Writing your report',
  notify: 'Preparing delivery',
};

/** Total pump units in a workflow (for the progress bar). */
export function totalUnits(workflow: WorkflowConfig, rubric: RubricConfig | null): number {
  let units = 0;
  for (const step of workflow.steps) {
    if (step.type === 'assess') units += Math.max(1, rubric?.principles.length ?? 1);
    else if (step.type === 'report') units += Math.max(1, step.config.sections.length);
    else units += 1;
  }
  return units;
}

/**
 * Units completed before `stepIndex`, plus `doneCount` sub-units completed
 * WITHIN it (the size of the current step's `run.done` set — parallel
 * sub-units make "how many of this step's units are done" the only
 * meaningful within-step count; there's no single cursor position anymore).
 */
export function unitsDone(
  workflow: WorkflowConfig,
  rubric: RubricConfig | null,
  stepIndex: number,
  doneCount: number,
): number {
  let done = 0;
  for (let i = 0; i < Math.min(stepIndex, workflow.steps.length); i++) {
    const step = workflow.steps[i];
    if (step.type === 'assess') done += Math.max(1, rubric?.principles.length ?? 1);
    else if (step.type === 'report') done += Math.max(1, step.config.sections.length);
    else done += 1;
  }
  return done + doneCount;
}
