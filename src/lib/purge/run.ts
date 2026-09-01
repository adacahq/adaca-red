import { createClient as createSupabaseClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database, FormConfig, WorkflowConfig } from '@/lib/supabase/types';
import { isExpired, resolveRetention } from '@/lib/settings/retention';
import { loadRetentionSettings } from '@/lib/settings/server';
import { removeDocumentObjects } from '@/lib/documents/server';
import { advanceRun, isTransientErrorText, retryRun } from '@/lib/workflows/runner';
import type { RunState } from '@/lib/workflows/types';

/**
 * The scheduled sweep (docs/workflow-forms-plan.md §9), invoked by the
 * worker's cron handler:
 *
 *  1. PUMP abandoned runs — submissions whose tab was closed mid-assessment
 *     get advanced to completion here (bounded units per sweep).
 *  2. REVIVE failed runs — a run that failed on a transient LLM error
 *     (529/429/5xx/network — see `isTransientErrorText`, runner.ts) gets
 *     retried automatically, bounded by `run.cronRetries` so a persistently
 *     broken run doesn't loop forever.
 *  3. PURGE expired nodes — WHOLE-node hard deletes per retention policy:
 *     Storage objects first (SQL can't remove them), then purge_nodes()
 *     (row + revisions + edges + documents, atomically).
 *
 * Pure orchestration over the service-role client; policies resolve through
 * the same retention module the public privacy copy uses.
 */

type DB = SupabaseClient<Database>;

export interface SweepResult {
  pumpedRuns: number;
  pumpedUnits: number;
  revivedRuns: number;
  purgedSubmissions: number;
  purgedAssessments: number;
  removedObjects: number;
  errors: string[];
}

const STALLED_AFTER_MS = 10 * 60 * 1000; // run untouched for 10 min = abandoned
const MAX_UNITS_PER_RUN = 40; // safety valve per submission per sweep
const MAX_RUNS_PER_SWEEP = 5;
const REVIVAL_WINDOW_MS = 48 * 60 * 60 * 1000; // don't dig up ancient failed runs
const MAX_CRON_RETRIES = 2; // per-run cap on sweep-driven revivals (run.cronRetries)

export function createServiceClient(url: string, serviceKey: string): DB {
  return createSupabaseClient<Database>(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

interface GovernedTypes {
  /** node type → forms that create it (for per-form retention overrides). */
  submissionTypes: Map<string, FormConfig[]>;
  assessmentTypes: Map<string, FormConfig[]>;
}

async function loadGovernedTypes(db: DB): Promise<GovernedTypes> {
  const { data: defs, error } = await db
    .from('definitions')
    .select('*')
    .in('kind', ['form', 'workflow']);
  if (error) throw error;

  const forms = (defs ?? [])
    .filter((d) => d.kind === 'form')
    .map((d) => (d.config ?? {}) as unknown as FormConfig);
  const workflows = (defs ?? [])
    .filter((d) => d.kind === 'workflow')
    .map((d) => ({ key: d.key, config: (d.config ?? {}) as unknown as WorkflowConfig }));

  const submissionTypes = new Map<string, FormConfig[]>();
  for (const f of forms) {
    if (!f.targetType) continue;
    submissionTypes.set(f.targetType, [...(submissionTypes.get(f.targetType) ?? []), f]);
  }

  const assessmentTypes = new Map<string, FormConfig[]>();
  for (const w of workflows) {
    if (!w.config.resultType) continue;
    const producingForms = forms.filter((f) => f.workflow === w.key);
    assessmentTypes.set(w.config.resultType, [
      ...(assessmentTypes.get(w.config.resultType) ?? []),
      ...producingForms,
    ]);
  }
  return { submissionTypes, assessmentTypes };
}

/** The single form override applying to a node, matched by data.form_key. */
function formFor(forms: FormConfig[], formKey: string, allForms: Map<string, FormConfig>): FormConfig | null {
  return allForms.get(formKey) ?? forms[0] ?? null;
}

export async function runSweep(db: DB, origin: string, now = new Date()): Promise<SweepResult> {
  const result: SweepResult = {
    pumpedRuns: 0,
    pumpedUnits: 0,
    revivedRuns: 0,
    purgedSubmissions: 0,
    purgedAssessments: 0,
    removedObjects: 0,
    errors: [],
  };

  const settings = await loadRetentionSettings(db);
  const governed = await loadGovernedTypes(db);
  const submissionTypeKeys = [...governed.submissionTypes.keys()];
  const assessmentTypeKeys = [...governed.assessmentTypes.keys()];

  // Index every form by key so per-node overrides match by data.form_key.
  const { data: formDefs } = await db.from('definitions').select('*').eq('kind', 'form');
  const formsByKey = new Map(
    (formDefs ?? []).map((d) => [d.key, (d.config ?? {}) as unknown as FormConfig]),
  );

  // ── 1. Pump abandoned runs ──────────────────────────────────
  if (submissionTypeKeys.length > 0) {
    const cutoff = new Date(now.getTime() - STALLED_AFTER_MS).toISOString();
    const { data: stalled, error } = await db
      .from('nodes')
      .select('id, data, updated_at')
      .in('type_key', submissionTypeKeys)
      .is('deleted_at', null)
      .lt('updated_at', cutoff)
      .limit(200);
    if (error) result.errors.push(`stalled query: ${error.message}`);
    for (const node of stalled ?? []) {
      const run = ((node.data ?? {}) as { run?: RunState }).run;
      if (!run || (run.status !== 'pending' && run.status !== 'running')) continue;
      if (result.pumpedRuns >= MAX_RUNS_PER_SWEEP) break;
      result.pumpedRuns += 1;
      for (let i = 0; i < MAX_UNITS_PER_RUN; i++) {
        try {
          const p = await advanceRun(db, node.id, origin);
          result.pumpedUnits += 1;
          if (!p || p.status === 'done' || p.status === 'failed' || p.executed === false) break;
        } catch (err) {
          result.errors.push(`pump ${node.id}: ${err instanceof Error ? err.message : 'failed'}`);
          break;
        }
      }
    }
  }

  // ── 2. Revive failed runs with a transient error ────────────
  // Shares the same MAX_RUNS_PER_SWEEP budget as stalled-run pumping above
  // (both count against result.pumpedRuns) — a sweep that's already busy
  // pumping abandoned runs doesn't also pile on fresh revivals.
  if (submissionTypeKeys.length > 0) {
    const revivalCutoff = new Date(now.getTime() - REVIVAL_WINDOW_MS).toISOString();
    const { data: failedNodes, error } = await db
      .from('nodes')
      .select('id, data, created_at')
      .in('type_key', submissionTypeKeys)
      .is('deleted_at', null)
      .eq('data->run->>status', 'failed')
      .gt('created_at', revivalCutoff)
      .limit(50);
    if (error) result.errors.push(`failed-run query: ${error.message}`);
    for (const node of failedNodes ?? []) {
      if (result.pumpedRuns >= MAX_RUNS_PER_SWEEP) break;
      const run = ((node.data ?? {}) as { run?: RunState }).run;
      if (!run || run.status !== 'failed' || run.finishedAt) continue;
      if (!isTransientErrorText(run.error ?? '')) continue;
      if ((run.cronRetries ?? 0) >= MAX_CRON_RETRIES) continue;

      result.pumpedRuns += 1;
      result.revivedRuns += 1;
      try {
        await retryRun(db, node.id, { countCronRetry: true });
      } catch (err) {
        result.errors.push(`revive ${node.id}: ${err instanceof Error ? err.message : 'failed'}`);
        continue;
      }
      for (let i = 0; i < MAX_UNITS_PER_RUN; i++) {
        try {
          const p = await advanceRun(db, node.id, origin);
          result.pumpedUnits += 1;
          if (!p || p.status === 'done' || p.status === 'failed' || p.executed === false) break;
        } catch (err) {
          result.errors.push(`pump ${node.id}: ${err instanceof Error ? err.message : 'failed'}`);
          break;
        }
      }
    }
  }

  // ── 3. Purge expired nodes (whole-node policies) ────────────
  const toPurge: { id: string; kind: 'submission' | 'assessment' }[] = [];

  if (submissionTypeKeys.length > 0) {
    const { data: nodes, error } = await db
      .from('nodes')
      .select('id, type_key, created_at, data')
      .in('type_key', submissionTypeKeys)
      .is('deleted_at', null)
      .limit(1000);
    if (error) result.errors.push(`submissions query: ${error.message}`);
    for (const node of nodes ?? []) {
      const data = (node.data ?? {}) as { run?: RunState; form_key?: string };
      const form = formFor(
        governed.submissionTypes.get(node.type_key) ?? [],
        data.form_key ?? '',
        formsByKey,
      );
      const setting = resolveRetention('submission', settings.submission, form);
      // Clock starts when the run FINISHES — an in-flight (or failed) run
      // holds its documents; nodes with no run at all clock from creation.
      const clockStart = data.run ? (data.run.finishedAt ?? null) : node.created_at;
      if (isExpired(setting, clockStart, now)) toPurge.push({ id: node.id, kind: 'submission' });
    }
  }

  if (assessmentTypeKeys.length > 0) {
    const { data: nodes, error } = await db
      .from('nodes')
      .select('id, type_key, created_at, data')
      .in('type_key', assessmentTypeKeys)
      .is('deleted_at', null)
      .limit(1000);
    if (error) result.errors.push(`assessments query: ${error.message}`);
    for (const node of nodes ?? []) {
      const data = (node.data ?? {}) as { form_key?: string };
      const form = formFor(
        governed.assessmentTypes.get(node.type_key) ?? [],
        data.form_key ?? '',
        formsByKey,
      );
      const setting = resolveRetention('assessment', settings.assessment, form);
      if (isExpired(setting, node.created_at, now)) toPurge.push({ id: node.id, kind: 'assessment' });
    }
  }

  if (toPurge.length > 0) {
    const ids = toPurge.map((p) => p.id);
    try {
      result.removedObjects = await removeDocumentObjects(db, ids);
      const { error } = await db.rpc('purge_nodes', { p_ids: ids });
      if (error) throw error;
      result.purgedSubmissions = toPurge.filter((p) => p.kind === 'submission').length;
      result.purgedAssessments = toPurge.filter((p) => p.kind === 'assessment').length;
    } catch (err) {
      result.errors.push(`purge: ${err instanceof Error ? err.message : 'failed'}`);
    }
  }

  return result;
}
