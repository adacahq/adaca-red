import type { SupabaseClient } from '@supabase/supabase-js';
import { APIConnectionError, APIError } from '@anthropic-ai/sdk';
import type {
  Database,
  FormConfig,
  Json,
  NodeRow,
  RubricConfig,
  WorkflowConfig,
  WorkflowStep,
} from '@/lib/supabase/types';
import { listDocuments, downloadDocument } from '@/lib/documents/server';
import { DEFAULT_MODEL, getAnthropic, type LlmDoc } from '@/lib/llm/anthropic';
import { runUnit, type StepCtx } from './steps';
import {
  STEP_LABELS,
  totalUnits,
  unitsDone,
  type NotifyOutput,
  type RunProgress,
  type RunState,
} from './types';

/**
 * The workflow runner (docs/workflow-forms-plan.md §7.3, revised for
 * parallel units): `advanceRun` claims and executes AT MOST one sub-unit of
 * the run's CURRENT step per call — but independent sub-units of the same
 * step (per-principle assess calls, per-section report calls) can now be
 * claimed and executed by DIFFERENT concurrent calls at once, instead of
 * strictly one-at-a-time. Each unit's output is written atomically to its
 * own jsonb slot via `complete_run_unit` (see the 20260718090000 migration)
 * — whole-node `save_node` persists cannot coexist with concurrent writers
 * (last-writer-wins would clobber sibling outputs). Drivers: the public
 * status page pumps it (N concurrent loops) while the submitter waits; the
 * purge cron sweeps abandoned runs. Each unit is bounded (≤ one LLM call),
 * so every invocation fits comfortably in a request. No waitUntil
 * dependency — identical behaviour in dev and on Workers.
 */

type DB = SupabaseClient<Database>;

const CLAIM_STALE_MS = 10 * 60 * 1000; // mirrors claim_run_unit's TTL — advisory prefilter only
const TRANSIENT_RETRY_MAX = 4; // release_run_unit's p_max — sub-unit fails the run after this many transient releases

/**
 * String-only transient-error heuristic, factored out so the cron sweep
 * (src/lib/purge/run.ts) can classify a run's STORED `run.error` text
 * without re-implementing the check — the production 529
 * (`{"type":"error","error":{"type":"overloaded_error","message":
 * "Overloaded"},...}`) reaches us already stringified, so a substring test
 * is the only signal that survives a round trip through `data.run.error`.
 */
export function isTransientErrorText(text: string): boolean {
  // 'output truncated' / 'malformed JSON' come from structuredCall/proseCall
  // (src/lib/llm/anthropic.ts): generation is stochastic, so a retry usually
  // completes within the ceiling — observed killing a production run
  // 2026-07-28 when one principle's adaptive thinking squeezed its own JSON
  // past max_tokens. Bounded by release_run_unit's retry cap like the rest.
  return /overloaded|rate limit|output truncated|malformed JSON/i.test(text);
}

/**
 * True for Anthropic errors worth retrying at the engine level instead of
 * failing the run outright: request timeouts, rate limits, and 5xx
 * (`APIError` with `.status` 408/429/>=500 — covers the 529 overloaded_error
 * seen in production, since the SDK's own `maxRetries: 1`, src/lib/llm/
 * anthropic.ts, doesn't always survive a sustained overload window) plus
 * network failures (`APIConnectionError`, which carries no `.status`). Falls
 * back to `isTransientErrorText` for errors that reach us already
 * stringified.
 */
export function isTransientLlmError(err: unknown): boolean {
  if (err instanceof APIConnectionError) return true;
  if (err instanceof APIError && typeof err.status === 'number') {
    if (err.status === 408 || err.status === 429 || err.status >= 500) return true;
  }
  return isTransientErrorText(err instanceof Error ? err.message : String(err));
}

export function initialRunState(workflowKey: string, now = new Date()): RunState {
  return {
    status: 'pending',
    workflow: workflowKey,
    stepIndex: 0,
    startedAt: now.toISOString(),
    steps: {},
    // Seeded {} (not left absent): claim_run_unit's jsonb_set needs an
    // existing parent to write run.claims.<sub> into on the very first
    // claim of a fresh run — see the migration header.
    done: {},
    claims: {},
  };
}

interface LoadedRun {
  node: NodeRow;
  data: Record<string, unknown>;
  run: RunState;
  workflow: WorkflowConfig | null;
  formLabel: string;
  form: FormConfig | null;
  rubric: RubricConfig | null;
}

async function loadRun(db: DB, submissionId: string): Promise<LoadedRun | null> {
  const { data: node, error } = await db
    .from('nodes')
    .select('*')
    .eq('id', submissionId)
    .is('deleted_at', null)
    .maybeSingle();
  if (error) throw error;
  if (!node) return null;

  const data = (node.data ?? {}) as Record<string, unknown>;
  const run = data.run as RunState | undefined;
  if (!run || !run.workflow) return null;

  const { data: wfDef } = await db
    .from('definitions')
    .select('*')
    .eq('kind', 'workflow')
    .eq('key', run.workflow)
    .maybeSingle();
  const workflow = wfDef ? ((wfDef.config ?? {}) as unknown as WorkflowConfig) : null;

  let form: FormConfig | null = null;
  let formLabel = 'Assessment';
  const formKey = typeof data.form_key === 'string' ? data.form_key : '';
  if (formKey) {
    const { data: formDef } = await db
      .from('definitions')
      .select('*')
      .eq('kind', 'form')
      .eq('key', formKey)
      .maybeSingle();
    if (formDef) {
      form = (formDef.config ?? {}) as unknown as FormConfig;
      formLabel = formDef.label;
    }
  }

  // The rubric drives progress arithmetic (assess = one unit per principle).
  let rubric: RubricConfig | null = null;
  const assessStep = workflow?.steps.find((s) => s.type === 'assess');
  if (assessStep && assessStep.type === 'assess') {
    rubric = await loadRubricDef(db, assessStep.config.rubric);
  }

  return { node, data, run, workflow, formLabel, form, rubric };
}

async function loadRubricDef(db: DB, key: string): Promise<RubricConfig | null> {
  const { data } = await db
    .from('definitions')
    .select('*')
    .eq('kind', 'rubric')
    .eq('key', key)
    .maybeSingle();
  return data ? ((data.config ?? {}) as unknown as RubricConfig) : null;
}

/** Sub-unit count for a step: assess = principles, report = sections, else 1. */
function stepSubCount(step: WorkflowStep, rubric: RubricConfig | null): number {
  if (step.type === 'assess') return Math.max(1, rubric?.principles.length ?? 1);
  if (step.type === 'report') return Math.max(1, step.config.sections.length);
  return 1;
}

function toProgress(loaded: LoadedRun, executed?: boolean): RunProgress {
  const { run, workflow, rubric } = loaded;
  const total = workflow ? totalUnits(workflow, rubric) : 1;
  const doneCount = Object.keys(run.done ?? {}).length;
  const done = workflow ? unitsDone(workflow, rubric, run.stepIndex, doneCount) : 0;
  const step = workflow?.steps[run.stepIndex];
  const notify = run.steps.notify as NotifyOutput | undefined;
  const progress: RunProgress = {
    status: run.status,
    progress: run.status === 'done' ? 1 : Math.min(0.98, total > 0 ? done / total : 0),
    stepLabel:
      run.status === 'done'
        ? 'Done'
        : run.status === 'failed'
          ? 'Failed'
          : step
            ? (step.label ?? STEP_LABELS[step.type])
            : 'Queued',
    reportToken: notify?.reportToken,
    error: run.status === 'failed' ? run.error : undefined,
  };
  if (executed !== undefined) progress.executed = executed;
  // Stage-list plumbing for the public status page (src/components/public/
  // RunStatus.tsx) — reuses stepSubCount, the SAME per-step sub-unit count
  // advanceRun uses for its claim barrier, rather than re-deriving it.
  if (workflow) {
    progress.stepIndex = run.stepIndex;
    progress.stepCount = workflow.steps.length;
    progress.subDone = doneCount;
    if (step) progress.subTotal = stepSubCount(step, rubric);
  }
  return progress;
}

/** Read-only progress for the public status endpoint. */
export async function getRunProgress(db: DB, submissionId: string): Promise<RunProgress | null> {
  const loaded = await loadRun(db, submissionId);
  return loaded ? toProgress(loaded) : null;
}

async function persist(db: DB, loaded: LoadedRun, changeNote: string): Promise<void> {
  loaded.data.run = loaded.run as unknown as Json;
  const { error } = await db.rpc('save_node', {
    p_id: loaded.node.id,
    p_type: loaded.node.type_key,
    p_parent: loaded.node.parent_id,
    p_data: loaded.data as Json,
    p_position: null as unknown as number,
    p_change_note: changeNote,
  });
  if (error) throw error;
}

/** Advance one unit. Returns the post-unit progress (null = unknown id). */
export async function advanceRun(
  db: DB,
  submissionId: string,
  origin: string,
): Promise<RunProgress | null> {
  const loaded = await loadRun(db, submissionId);
  if (!loaded) return null;
  const { run, workflow } = loaded;

  if (run.status === 'done' || run.status === 'failed') return toProgress(loaded, false);

  if (!workflow) {
    // Misconfiguration, not a concurrency case: nothing else can be racing a
    // workflow key that doesn't resolve, so the plain whole-node persist
    // (predating the per-slot RPCs) is safe here.
    run.status = 'failed';
    run.error = `Unknown workflow: ${run.workflow}`;
    loaded.data.status = 'failed';
    await persist(db, loaded, 'workflow: missing definition');
    return toProgress(loaded, true);
  }

  const step = workflow.steps[run.stepIndex];
  if (!step) {
    // Same rationale: stepIndex running past workflow.steps.length means the
    // workflow definition shrank underneath a live run — terminal misconfig,
    // no concurrent unit in flight for this (nonexistent) step to race.
    run.status = 'done';
    run.finishedAt = new Date().toISOString();
    await persist(db, loaded, 'workflow: complete');
    return toProgress(loaded, true);
  }

  // Candidate sub-units: not already done, not freshly claimed in the
  // snapshot we just loaded. This is an ADVISORY prefilter only — it just
  // picks a plausible sub to try first; claim_run_unit is the real,
  // race-safe gate (another pumper may have claimed/finished it since we
  // loaded).
  const subCount = stepSubCount(step, loaded.rubric);
  const doneKeys = new Set(Object.keys(run.done ?? {}));
  const claims = run.claims ?? {};
  const staleCutoffMs = Date.now() - CLAIM_STALE_MS;
  const candidates: number[] = [];
  for (let i = 0; i < subCount; i++) {
    if (doneKeys.has(String(i))) continue;
    const claim = claims[String(i)];
    if (claim && Date.parse(claim.at) > staleCutoffMs) continue;
    candidates.push(i);
  }

  // Crash rescue: if every sub-unit is done but the step never advanced, the
  // pumper that completed the final unit died between complete_run_unit and
  // advance_run_step. Nobody else would ever advance it (no candidates, no
  // claim left to expire) — fire the idempotent advance ourselves.
  if (candidates.length === 0 && doneKeys.size >= subCount) {
    const isLastStep = run.stepIndex + 1 >= workflow.steps.length;
    const { error: rescueError } = await db.rpc('advance_run_step', {
      p_id: loaded.node.id,
      p_from_step: run.stepIndex,
      p_total_subs: subCount,
      p_last_step: isLastStep,
      p_change_note: `workflow: ${STEP_LABELS[step.type]}`,
    });
    if (rescueError) throw rescueError;
    run.stepIndex += 1;
    run.done = {};
    run.claims = {};
    if (isLastStep) {
      run.status = 'done';
      run.finishedAt = new Date().toISOString();
    }
    return toProgress(loaded, true);
  }

  let sub = -1;
  let token: string | null = null;
  for (const candidate of candidates) {
    const { data: claimToken, error: claimError } = await db.rpc('claim_run_unit', {
      p_id: loaded.node.id,
      p_step: run.stepIndex,
      p_sub: candidate,
    });
    if (claimError) throw claimError;
    if (claimToken) {
      sub = candidate;
      token = claimToken;
      break;
    }
  }
  if (!token) return toProgress(loaded, false); // nothing claimable right now — another pumper is live

  // Mirror claim_run_unit's own state transition into the local snapshot so
  // this call's response doesn't show a stale 'pending' — the transition
  // already happened atomically server-side, inside the RPC.
  run.status = 'running';

  // Everything below runs INSIDE the try: it sits after a successful claim,
  // so a persistent failure here must mark the run failed via fail_run_unit
  // (below) rather than throw past this function — an uncaught post-claim
  // throw would 500 the request while the claim itself still expires on
  // schedule, freezing the status page for the full TTL every retry.
  try {
    const documents = await listDocuments(db, loaded.node.id);
    const rubricCache = new Map<string, RubricConfig>();
    let llmDocsCache: LlmDoc[] | null = null;

    const ctx: StepCtx = {
      db,
      anthropic: getAnthropic,
      model: workflow.model ?? DEFAULT_MODEL,
      submission: loaded.node,
      data: loaded.data,
      run,
      workflow,
      form: loaded.form,
      formLabel: loaded.formLabel,
      documents,
      origin,
      async loadRubric(key: string) {
        const hit = rubricCache.get(key);
        if (hit) return hit;
        const rubric = await loadRubricDef(db, key);
        if (!rubric) throw new Error(`Unknown rubric: ${key}`);
        rubricCache.set(key, rubric);
        return rubric;
      },
      async llmDocs() {
        if (llmDocsCache) return llmDocsCache;
        const docs: LlmDoc[] = [];
        for (const d of documents) {
          if (d.text_content) {
            docs.push({ filename: d.filename, kind: 'text', text: d.text_content });
          } else if (d.mime_type === 'application/pdf') {
            docs.push({ filename: d.filename, kind: 'pdf', bytes: await downloadDocument(db, d) });
          }
        }
        llmDocsCache = docs;
        return docs;
      },
    };

    const result = await runUnit(ctx, step, sub);
    const { data: doneCount, error: completeError } = await db.rpc('complete_run_unit', {
      p_id: loaded.node.id,
      p_step: run.stepIndex,
      p_sub: sub,
      p_token: token,
      p_slot: result.slot,
      p_output: result.output,
      p_merge: result.merge,
    });
    if (completeError) throw completeError;

    if (doneCount == null) {
      // Our claim was stolen (TTL expiry + another pumper) between claiming
      // and finishing — complete_run_unit matched no row. The unit's output
      // is discarded: whoever holds the live claim owns this sub-unit now
      // and will redo it. Not an error, just stale work.
      return toProgress(loaded, true);
    }

    if (step.type === 'notify') {
      // toProgress reads reportToken off run.steps.notify; mirror the output
      // we just persisted so a 'done' response from THIS call can redirect
      // immediately, without another poll round-trip.
      run.steps.notify = result.output as unknown as NotifyOutput;
    }
    run.done = { ...(run.done ?? {}), [String(sub)]: true };

    if (doneCount >= subCount) {
      const isLastStep = run.stepIndex + 1 >= workflow.steps.length;
      const { error: advanceError } = await db.rpc('advance_run_step', {
        p_id: loaded.node.id,
        p_from_step: run.stepIndex,
        p_total_subs: subCount,
        p_last_step: isLastStep,
        p_change_note: `workflow: ${STEP_LABELS[step.type]}`,
      });
      if (advanceError) throw advanceError;
      // Another pumper may have already advanced first (benign — that call
      // returns false and this one is a no-op); either way our local view
      // below reflects what we believe just happened, for THIS response.
      run.stepIndex += 1;
      run.done = {};
      run.claims = {};
      if (isLastStep) {
        run.status = 'done';
        run.finishedAt = new Date().toISOString();
      }
    }

    return toProgress(loaded, true);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Workflow step failed';

    if (isTransientLlmError(err)) {
      // Release rather than fail: the request itself wasn't wrong, the API
      // was just busy. release_run_unit removes the claim so the SAME
      // sub-unit is immediately re-claimable, up to TRANSIENT_RETRY_MAX
      // releases before it gives up and fails the run for real.
      const { data: count, error: releaseError } = await db.rpc('release_run_unit', {
        p_id: loaded.node.id,
        p_step: run.stepIndex,
        p_sub: sub,
        p_token: token,
        p_max: TRANSIENT_RETRY_MAX,
        p_error: message,
        p_change_note: `workflow failed: ${STEP_LABELS[step.type]} (transient retries exhausted)`,
      });
      if (releaseError) throw releaseError;
      if (count == null) {
        // Claim already stolen by the time we hit this failure — same
        // swallow rationale as fail_run_unit's `!failed` branch below.
        return toProgress(loaded, true);
      }
      if (count >= TRANSIENT_RETRY_MAX) {
        // Terminal: mirror the local snapshot so THIS response reflects the
        // failure the RPC just persisted (a sub-cap release needs no local
        // mirroring — the claim was never in the local snapshot to begin
        // with).
        run.status = 'failed';
        run.error = message;
      }
      return toProgress(loaded, true);
    }

    const { data: failed, error: failError } = await db.rpc('fail_run_unit', {
      p_id: loaded.node.id,
      p_step: run.stepIndex,
      p_sub: sub,
      p_token: token,
      p_error: message,
      p_change_note: `workflow failed: ${STEP_LABELS[step.type]}`,
    });
    if (failError) throw failError;
    if (!failed) {
      // Our claim was already stolen by the time we hit this failure — the
      // run belongs to someone else now; swallow rather than report a
      // failure we no longer own.
      return toProgress(loaded, true);
    }
    run.status = 'failed';
    run.error = message;
    return toProgress(loaded, true);
  }
}

/**
 * Restart a failed run from its failed step (admin action / cron retry). The
 * failed step's own partial output is safe to overwrite — units are
 * idempotent. Uses save_node (not the per-slot RPCs): a failed run has no
 * concurrent writers by definition, so a whole-node persist is safe here.
 *
 * `opts.countCronRetry` is set by the cron sweep (src/lib/purge/run.ts) when
 * IT is the one reviving a transiently-failed run, so `run.cronRetries`
 * tracks sweep-driven revivals specifically (capped independently there) —
 * an admin-triggered retry doesn't count against that budget.
 */
export async function retryRun(
  db: DB,
  submissionId: string,
  opts?: { countCronRetry?: boolean },
): Promise<RunProgress | null> {
  const loaded = await loadRun(db, submissionId);
  if (!loaded) return null;
  if (loaded.run.status !== 'failed') return toProgress(loaded);
  loaded.run.status = 'pending';
  loaded.run.error = undefined;
  // Defensive: a pre-migration failed run has neither field. Keep `done` —
  // retry should only re-execute the incomplete subs of the step it died on
  // — but claims are stale by definition (the run was dead), so those clear.
  loaded.run.done = loaded.run.done ?? {};
  loaded.run.claims = {};
  loaded.run.retries = {};
  if (opts?.countCronRetry) loaded.run.cronRetries = (loaded.run.cronRetries ?? 0) + 1;
  loaded.data.status = 'processing';
  await persist(db, loaded, 'workflow: retry');
  return toProgress(loaded);
}
