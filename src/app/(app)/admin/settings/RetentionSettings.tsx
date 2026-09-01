'use client';

import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import Button from '@/components/ui/Button';
import Select from '@/components/ui/Select';
import type { RetentionSetting } from '@/lib/supabase/types';
import { retentionCopy } from '@/lib/settings/retention';
import { updateRetention } from '@/lib/settings/actions';

const MODES = [
  { value: 'off', label: 'Delete when done' },
  { value: 'days', label: 'Keep for N days' },
  { value: 'persist', label: 'Keep indefinitely' },
];

function Clock({
  label,
  hint,
  value,
  onChange,
}: {
  label: string;
  hint: string;
  value: RetentionSetting;
  onChange: (v: RetentionSetting) => void;
}) {
  return (
    <div className="py-5" style={{ borderBottom: '1px solid var(--line)' }}>
      <p className="field-label">{label}</p>
      <p className="text-[12px] mb-3" style={{ color: 'var(--muted)', maxWidth: 520, lineHeight: 1.6 }}>{hint}</p>
      <div className="flex items-center gap-3">
        <div style={{ width: 200 }}>
          <Select
            fullWidth
            ariaLabel={`${label} mode`}
            value={value.mode}
            onChange={(v) => onChange({ mode: v as RetentionSetting['mode'], days: value.days })}
            options={MODES}
          />
        </div>
        {value.mode === 'days' && (
          <input
            type="number"
            className="field-input"
            style={{ width: 90 }}
            min={1}
            aria-label={`${label} days`}
            value={value.days ?? 1}
            onChange={(e) => onChange({ mode: 'days', days: Math.max(1, Number(e.target.value) || 1) })}
          />
        )}
        {value.mode === 'days' && (
          <span className="text-[12px]" style={{ color: 'var(--muted)' }}>days after completion</span>
        )}
      </div>
    </div>
  );
}

export default function RetentionSettings({
  initial,
}: {
  initial: { submission: RetentionSetting; assessment: RetentionSetting };
}) {
  const [submission, setSubmission] = useState<RetentionSetting>(initial.submission);
  const [assessment, setAssessment] = useState<RetentionSetting>(initial.assessment);
  const [pending, startTransition] = useTransition();

  function save() {
    startTransition(async () => {
      try {
        await updateRetention({ submission, assessment });
        toast.success('Retention updated');
      } catch (err) {
        toast.error('Couldn’t save', { description: err instanceof Error ? err.message : undefined });
      }
    });
  }

  return (
    <div style={{ maxWidth: 640 }}>
      <div style={{ borderTop: '1px solid var(--line)' }}>
        <Clock
          label="Submitted data"
          hint="Form submissions and their uploaded documents. The clock starts when the assessment finishes; in-flight and failed runs are held until resolved."
          value={submission}
          onChange={setSubmission}
        />
        <Clock
          label="Assessment results"
          hint="Findings, verdicts and reports (including the emailed report links — deleting these breaks the links). Also the lead trail: contact fields carry over here."
          value={assessment}
          onChange={setAssessment}
        />
      </div>

      <p className="mt-4 text-[12px]" style={{ color: 'var(--muted)', lineHeight: 1.7, maxWidth: 560 }}>
        Public forms will say: &ldquo;{retentionCopy(submission, assessment)}&rdquo;
      </p>

      <div className="mt-6">
        <Button variant="primary" size="sm" onClick={save} disabled={pending}>
          {pending && <span className="spinner" aria-hidden />}Save retention
        </Button>
      </div>
    </div>
  );
}
