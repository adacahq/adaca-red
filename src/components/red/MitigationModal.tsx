'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
import Select from '@/components/ui/Select';
import DatePicker from '@/components/ui/DatePicker';
import { saveEdge } from '@/lib/nodes/actions';
import { readRed, redTotal } from '@/lib/red';

const SCORES = [0, 1, 2, 3, 4];
const AXES = [
  { key: 'relevance', label: 'Relevance', hint: 'Does it address the real driver?' },
  { key: 'extent', label: 'Extent', hint: 'How much of the exposure is covered?' },
  { key: 'duration', label: 'Duration', hint: 'Does the protection hold over time?' },
] as const;

function band(total: number): string {
  return total <= 3 ? 'Weak' : total <= 6 ? 'Limited' : total <= 9 ? 'Moderate' : 'Strong';
}

/**
 * Score (or rescore) an Initiative→Risk mitigation. Opened when a user links a
 * risk to an initiative — assigning the relationship asks for the RED score
 * up-front rather than creating an empty edge.
 */
export default function MitigationModal({
  open,
  onClose,
  fixed,
  options,
  edge,
  revalidatePath,
}: {
  open: boolean;
  onClose: () => void;
  fixed: { role: 'initiative' | 'risk'; id: string };
  options: { id: string; title: string }[];
  edge?: { id: string; otherId: string; data: unknown } | null;
  revalidatePath: string;
}) {
  const isEdit = !!edge;
  const r = readRed(edge?.data);
  const [other, setOther] = useState(edge?.otherId ?? '');
  const [relevance, setRelevance] = useState(r.relevance);
  const [extent, setExtent] = useState(r.extent);
  const [duration, setDuration] = useState(r.duration);
  const [date, setDate] = useState(r.assessmentDate ?? '');
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const setters = { relevance: setRelevance, extent: setExtent, duration: setDuration };
  const values = { relevance, extent, duration };
  const total = redTotal({ relevance, extent, duration });

  function save() {
    const initiativeId = fixed.role === 'initiative' ? fixed.id : other;
    const riskId = fixed.role === 'risk' ? fixed.id : other;
    if (!initiativeId || !riskId) return;
    startTransition(async () => {
      await saveEdge({
        id: edge?.id ?? null,
        type: 'mitigates',
        from: initiativeId,
        to: riskId,
        data: { relevance, extent, duration, assessmentDate: date || null },
        changeNote: isEdit ? 'scored' : 'linked',
        revalidate: revalidatePath,
      });
      router.refresh();
      onClose();
    });
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? 'Edit RED score' : 'Mitigate a risk'}
      maxWidth={540}
      footer={
        <>
          <Button variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
          <Button variant="primary" size="sm" onClick={save} disabled={pending || (!isEdit && !other)}>
            {pending && <span className="spinner" aria-hidden />}
            {isEdit ? 'Save' : 'Add mitigation'}
          </Button>
        </>
      }
    >
      {!isEdit && (
        <div className="mb-6">
          <label className="field-label">
            {fixed.role === 'initiative' ? 'Risk to mitigate' : 'Mitigating initiative'}
          </label>
          <Select
            fullWidth
            placeholder="Select…"
            value={other}
            onChange={setOther}
            options={options.map((o) => ({ value: o.id, label: o.title }))}
          />
        </div>
      )}

      <div className="flex items-baseline justify-between mb-3">
        <span className="field-label" style={{ margin: 0 }}>RED score</span>
        <span className="mono" style={{ fontSize: 11, color: 'var(--muted)' }}>
          {total}/12 · <span style={{ color: 'var(--accent)' }}>{band(total)}</span>
        </span>
      </div>

      <div className="flex flex-col gap-4">
        {AXES.map((a) => (
          <div key={a.key} className="flex items-center justify-between gap-4">
            <span>
              <span style={{ fontSize: 13, color: 'var(--ink)' }}>{a.label}</span>
              <span className="block text-[11px]" style={{ color: 'var(--muted-2)' }}>{a.hint}</span>
            </span>
            <div className="seg shrink-0" role="radiogroup" aria-label={a.label}>
              {SCORES.map((s) => (
                <button
                  key={s}
                  type="button"
                  role="radio"
                  aria-checked={values[a.key] === s}
                  className={values[a.key] === s ? 'seg-btn on' : 'seg-btn'}
                  onClick={() => setters[a.key](s)}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        ))}
        <div className="flex items-center justify-between gap-4">
          <span style={{ fontSize: 13, color: 'var(--ink)' }}>Assessed</span>
          <DatePicker value={date} onChange={setDate} />
        </div>
      </div>
    </Modal>
  );
}
