import type { CSSProperties } from 'react';
import { createAdminClient } from '@/lib/supabase/admin';
import type { WorkflowConfig } from '@/lib/supabase/types';
import { STEP_LABELS, type RunState } from '@/lib/workflows/types';
import RunStatus from '@/components/public/RunStatus';

export const metadata = { robots: { index: false, follow: false } };

/** Public run-status page: pumps the workflow while the submitter waits. */
export default async function StatusPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  // Best-effort presentation lookup only — a missing submission or run falls
  // through to today's generic copy/UI (RunStatus itself already 404s an
  // unknown id into the stalled state; this page introduces no new error path).
  const db = createAdminClient();
  const { data: node } = await db.from('nodes').select('data').eq('id', id).is('deleted_at', null).maybeSingle();
  const data = (node?.data ?? {}) as Record<string, unknown>;
  const run = data.run as RunState | undefined;

  let workflow: WorkflowConfig | null = null;
  if (run?.workflow) {
    const { data: wfDef } = await db
      .from('definitions')
      .select('config')
      .eq('kind', 'workflow')
      .eq('key', run.workflow)
      .maybeSingle();
    workflow = wfDef ? ((wfDef.config ?? {}) as unknown as WorkflowConfig) : null;
  }

  const status = workflow?.status;
  const [expectedMin, expectedMax] = status?.expectedMinutes ?? [];
  const timeCopy =
    expectedMin != null && expectedMax != null
      ? `This usually takes ${expectedMin}–${expectedMax} minutes.`
      : 'This usually takes a few minutes.';
  const stages =
    status?.showStages && workflow
      ? workflow.steps.map((s) => ({ label: s.label ?? STEP_LABELS[s.type] }))
      : undefined;

  return (
    <div>
      <p className="eyebrow rv">Diagnostic</p>
      <h1 className="view-title rv" style={{ '--i': 1 } as CSSProperties}>
        Reading your documents…
      </h1>
      <p className="lede rv" style={{ '--i': 2 } as CSSProperties}>
        {timeCopy} Keep this page open and we&rsquo;ll take you to
        your report the moment it&rsquo;s ready.
      </p>
      <div className="mt-10">
        <RunStatus submissionId={id} stages={stages} showDetail={status?.showDetail} />
      </div>
    </div>
  );
}
