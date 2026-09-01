import type { FormConfig, RetentionSetting } from '@/lib/supabase/types';

/**
 * Retention semantics (docs/workflow-forms-plan.md §9). Pure logic — no I/O —
 * so the purge cron and the public privacy copy resolve policies identically.
 *
 * Policies are WHOLE-NODE: a governed node past its clock is hard-deleted
 * (row + revisions + documents). Nothing here inspects node data beyond the
 * clock timestamps the caller passes in.
 */

export const RETENTION_KEYS = {
  submission: 'retention.submission',
  assessment: 'retention.assessment',
} as const;

export const DEFAULT_RETENTION: Record<'submission' | 'assessment', RetentionSetting> = {
  submission: { mode: 'days', days: 1 },
  assessment: { mode: 'persist' },
};

/** Per-form override wins over the app-wide setting, which wins over defaults. */
export function resolveRetention(
  kind: 'submission' | 'assessment',
  appSetting: RetentionSetting | undefined,
  form?: Pick<FormConfig, 'retention'> | null,
): RetentionSetting {
  return form?.retention?.[kind] ?? appSetting ?? DEFAULT_RETENTION[kind];
}

/**
 * Whether a node whose clock started at `clockStart` is due for purge at
 * `now`. `mode:'off'` purges as soon as the clock starts (delete when done);
 * `mode:'persist'` never purges; a missing clockStart never purges (e.g. a
 * submission whose run hasn't finished holds until it does).
 */
export function isExpired(
  setting: RetentionSetting,
  clockStart: string | null | undefined,
  now: Date,
): boolean {
  if (setting.mode === 'persist') return false;
  if (!clockStart) return false;
  const started = Date.parse(clockStart);
  if (Number.isNaN(started)) return false;
  if (setting.mode === 'off') return started <= now.getTime();
  const days = setting.days ?? 0;
  if (days <= 0) return started <= now.getTime();
  return started + days * 24 * 60 * 60 * 1000 <= now.getTime();
}

/** The public privacy line, generated FROM the live setting so it can't drift. */
export function retentionCopy(submission: RetentionSetting, assessment: RetentionSetting): string {
  let docs: string;
  switch (submission.mode) {
    case 'off':
      docs = 'Your uploaded documents are deleted as soon as your assessment completes.';
      break;
    case 'days': {
      const d = submission.days ?? 1;
      docs = `Your uploaded documents are deleted within ${d === 1 ? '24 hours' : `${d} days`} of your assessment completing.`;
      break;
    }
    case 'persist':
    default:
      docs = 'Your uploaded documents are retained to support your assessment.';
      break;
  }
  let report: string;
  switch (assessment.mode) {
    case 'off':
      report = 'Your report is not retained after delivery.';
      break;
    case 'days':
      report = `Your report is retained for ${assessment.days ?? 0} days so your link keeps working.`;
      break;
    case 'persist':
    default:
      report = 'Your report is retained so your link keeps working.';
      break;
  }
  return `${docs} ${report}`;
}
