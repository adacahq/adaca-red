'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'sonner';
import type { FieldDef } from '@/lib/supabase/types';
import { fieldsToZod } from '@/lib/definitions/zod';
import FieldInput, { type FieldValueT } from '@/components/fields/FieldInput';

type Values = Record<string, FieldValueT>;

/** Convert empty strings to undefined so optional fields validate cleanly. */
function normalise(values: Values): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(values)) out[k] = v === '' ? undefined : v;
  return out;
}

/** Clean object for storage: drop undefined, keep dates as yyyy-mm-dd strings. */
function forStorage(parsed: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(parsed)) {
    if (v === undefined || v === null) continue;
    out[k] = v instanceof Date ? v.toISOString().slice(0, 10) : v;
  }
  return out;
}

export default function EntityForm({
  fields,
  initial,
  submit,
  basePath,
  submitLabel = 'Save',
  cancelHref,
  entityLabel = 'Item',
  mode = 'create',
}: {
  fields: FieldDef[];
  initial?: Record<string, unknown>;
  submit: (data: Record<string, unknown>) => Promise<string>;
  basePath: string;
  submitLabel?: string;
  cancelHref?: string;
  entityLabel?: string;
  mode?: 'create' | 'edit';
}) {
  const ordered = [...fields].sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
  const [values, setValues] = useState<Values>(() => {
    const v: Values = {};
    for (const f of ordered) v[f.key] = (initial?.[f.key] as FieldValueT) ?? '';
    return v;
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const router = useRouter();

  function validate(): Record<string, unknown> | null {
    const schema = fieldsToZod(ordered);
    const result = schema.safeParse(normalise(values));
    if (!result.success) {
      const errs: Record<string, string> = {};
      for (const issue of result.error.issues) {
        const key = String(issue.path[0] ?? '');
        if (key && !errs[key]) errs[key] = issue.message;
      }
      setErrors(errs);
      toast.error('Check the form', { description: 'Some fields need attention.' });
      return null;
    }
    setErrors({});
    return forStorage(result.data as Record<string, unknown>);
  }

  function go(addAnother: boolean) {
    if (submitting) return;
    setFormError(null);
    const payload = validate();
    if (!payload) return;

    const name = String((values.title as string) ?? '').trim();
    setSubmitting(true);
    (async () => {
      try {
        const id = await submit(payload);
        toast.success(`${entityLabel} ${mode === 'edit' ? 'saved' : 'created'}`, {
          description: name || undefined,
        });
        if (addAnother) {
          // Keep the values populated so the next, similar record is quick to enter.
          window.scrollTo({ top: 0, behavior: 'smooth' });
        } else {
          router.push(`${basePath}/${id}`);
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Save failed';
        setFormError(msg);
        toast.error('Couldn’t save', { description: msg });
      } finally {
        setSubmitting(false);
      }
    })();
  }

  return (
    <form onSubmit={(e) => { e.preventDefault(); go(false); }} className="max-w-2xl">
      {formError && (
        <div
          className="mb-6 px-4 py-3 text-[13px]"
          style={{
            background: 'var(--red-tint)',
            color: 'var(--red-ink)',
            border: '1px solid color-mix(in srgb, var(--red) 25%, transparent)',
          }}
        >
          {formError}
        </div>
      )}

      <div className="flex flex-col gap-6">
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
              <p className="mt-1 text-[12px]" style={{ color: 'var(--red)' }}>
                {errors[f.key]}
              </p>
            )}
          </div>
        ))}
      </div>

      <div className="mt-8 flex flex-wrap items-center gap-3">
        <button type="submit" className="btn btn-primary btn-sm" disabled={submitting}>
          {submitting && <span className="spinner" aria-hidden />}
          {submitLabel}
        </button>
        {mode === 'create' && (
          <button type="button" className="btn btn-ghost btn-sm" disabled={submitting} onClick={() => go(true)}>
            Create &amp; add another
          </button>
        )}
        {cancelHref && (
          <Link href={cancelHref} className="btn btn-ghost btn-sm">
            Cancel
          </Link>
        )}
      </div>
    </form>
  );
}
