'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
import Select from '@/components/ui/Select';
import FieldInput, { type FieldValueT } from '@/components/fields/FieldInput';
import { fieldsToZod } from '@/lib/definitions/zod';
import { saveNode } from '@/lib/nodes/actions';
import type { FieldDef, NodeRow } from '@/lib/supabase/types';

export interface ParentOption {
  value: string;
  label: string;
  /** Position to use when moving into this parent (append to its children). */
  position: number;
}

/** Full-field node editor in a modal (used for tasks/groups in the tree).
 *  When `parentOptions` is supplied the node can also be re-parented (move). */
export default function NodeEditModal({
  open,
  onClose,
  node,
  fields,
  typeLabel,
  parentOptions,
  revalidatePath,
}: {
  open: boolean;
  onClose: () => void;
  node: NodeRow;
  fields: FieldDef[];
  typeLabel: string;
  parentOptions?: ParentOption[];
  revalidatePath: string;
}) {
  const ordered = [...fields].sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
  const data = (node.data ?? {}) as Record<string, unknown>;
  const [parentId, setParentId] = useState<string>(node.parent_id ?? '');
  const canMove = !!parentOptions && parentOptions.length > 1;

  const [values, setValues] = useState<Record<string, FieldValueT>>(() => {
    const v: Record<string, FieldValueT> = {};
    for (const f of ordered) v[f.key] = (data[f.key] as FieldValueT) ?? '';
    return v;
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function submit() {
    setFormError(null);
    const input = Object.fromEntries(
      Object.entries(values).map(([k, v]) => [k, v === '' ? undefined : v]),
    );
    const result = fieldsToZod(ordered).safeParse(input);
    if (!result.success) {
      const errs: Record<string, string> = {};
      for (const issue of result.error.issues) {
        const key = String(issue.path[0] ?? '');
        if (key && !errs[key]) errs[key] = issue.message;
      }
      setErrors(errs);
      return;
    }
    setErrors({});
    const clean: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(result.data as Record<string, unknown>)) {
      if (v === undefined || v === null) continue;
      clean[k] = v instanceof Date ? v.toISOString().slice(0, 10) : v;
    }
    const moving = canMove && parentId !== (node.parent_id ?? '');
    const appendPos = parentOptions?.find((p) => p.value === parentId)?.position;
    startTransition(async () => {
      try {
        await saveNode({
          id: node.id,
          type: node.type_key,
          parent: canMove ? parentId : node.parent_id,
          data: clean,
          // Append to the new parent on a move; preserve position on a plain edit.
          position: moving ? appendPos ?? 0 : undefined,
          changeNote: moving ? 'moved' : 'edited',
          revalidate: revalidatePath,
        });
        router.refresh();
        onClose();
      } catch (err) {
        setFormError(err instanceof Error ? err.message : 'Save failed');
      }
    });
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Edit ${typeLabel}`}
      maxWidth={560}
      footer={
        <>
          <Button variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
          <Button variant="primary" size="sm" onClick={submit} disabled={pending}>
            {pending && <span className="spinner" aria-hidden />}
            Save
          </Button>
        </>
      }
    >
      {formError && (
        <div
          className="mb-5 px-4 py-3 text-[13px]"
          style={{ background: 'var(--red-tint)', color: 'var(--red-ink)', border: '1px solid color-mix(in srgb, var(--crit) 25%, transparent)' }}
        >
          {formError}
        </div>
      )}
      <div className="flex flex-col gap-5">
        {canMove && (
          <div>
            <label className="field-label">Parent</label>
            <Select
              fullWidth
              value={parentId}
              onChange={setParentId}
              options={(parentOptions ?? []).map((p) => ({ value: p.value, label: p.label }))}
              ariaLabel="Parent"
            />
          </div>
        )}
        {ordered.map((f) => (
          <div key={f.key}>
            <label className="field-label" htmlFor={`f-${f.key}`}>
              {f.label}
              {f.required && <span style={{ color: 'var(--accent)' }}> *</span>}
            </label>
            <FieldInput
              field={f}
              value={values[f.key]}
              onChange={(v) => setValues((s) => ({ ...s, [f.key]: v }))}
            />
            {errors[f.key] && (
              <p className="mt-1 text-[12px]" style={{ color: 'var(--crit)' }}>{errors[f.key]}</p>
            )}
          </div>
        ))}
      </div>
    </Modal>
  );
}
