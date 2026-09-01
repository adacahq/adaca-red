'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { FieldDef, FormConfig } from '@/lib/supabase/types';
import { fieldsToZod } from '@/lib/definitions/zod';
import FieldInput, { rendersOwnLabel, type FieldValueT } from '@/components/fields/FieldInput';
import FileDrop from './FileDrop';
import Turnstile from './Turnstile';
import { MAX_TOTAL_UPLOAD_BYTES, MAX_UPLOAD_BYTES } from '@/lib/forms/config';

type Values = Record<string, FieldValueT>;

/**
 * The public intake form: exposed fields rendered from the target type's
 * definitions (same FieldInput machinery as the app), uploads, Turnstile.
 * Posts multipart to ./submit and hands off to the status page.
 */
export default function PublicForm({
  formKey,
  fields,
  uploads,
  submitLabel,
  turnstileSiteKey,
}: {
  formKey: string;
  fields: FieldDef[];
  uploads: FormConfig['uploads'] | null;
  submitLabel: string;
  turnstileSiteKey: string;
}) {
  const router = useRouter();
  const [values, setValues] = useState<Values>(() => {
    const v: Values = {};
    for (const f of fields) v[f.key] = '';
    return v;
  });
  const [files, setFiles] = useState<File[]>([]);
  const [turnstileToken, setTurnstileToken] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function validate(): Record<string, unknown> | null {
    const normalised: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(values)) normalised[k] = v === '' ? undefined : v;
    const result = fieldsToZod(fields).safeParse(normalised);
    if (!result.success) {
      const errs: Record<string, string> = {};
      for (const issue of result.error.issues) {
        const key = String(issue.path[0] ?? '');
        if (key && !errs[key]) errs[key] = issue.message;
      }
      setErrors(errs);
      return null;
    }
    setErrors({});
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(result.data as Record<string, unknown>)) {
      if (v === undefined || v === null) continue;
      out[k] = v instanceof Date ? v.toISOString().slice(0, 10) : v;
    }
    return out;
  }

  async function submit() {
    if (submitting) return;
    setFormError(null);
    const payload = validate();
    if (!payload) return;
    if (uploads?.enabled && files.length < (uploads.minFiles ?? 0)) {
      setFormError(`Please attach at least ${uploads.minFiles} document${uploads.minFiles === 1 ? '' : 's'}.`);
      return;
    }
    if (turnstileSiteKey && !turnstileToken) {
      setFormError('Please complete the verification below.');
      return;
    }

    setSubmitting(true);
    try {
      const body = new FormData();
      body.set('values', JSON.stringify(payload));
      body.set('turnstile', turnstileToken);
      for (const f of files) body.append('files', f, f.name);

      const res = await fetch(`/d/${encodeURIComponent(formKey)}/submit`, { method: 'POST', body });
      // Oversize requests are rejected by the platform before our handler
      // runs, so the body may not be JSON — parse defensively.
      const json = (await res.json().catch(() => ({}))) as { id?: string; error?: string };
      if (!res.ok || !json.id) {
        setFormError(
          json.error ??
            (res.status === 413
              ? 'Your documents are too large to upload together. Remove a file and try again.'
              : 'Something went wrong. Please try again.'),
        );
        setSubmitting(false);
        return;
      }
      router.push(`/d/s/${json.id}`);
    } catch {
      setFormError('Network problem. Please try again.');
      setSubmitting(false);
    }
  }

  return (
    <form id="form" onSubmit={(e) => { e.preventDefault(); void submit(); }}>
      {formError && (
        <div
          className="mb-6 px-4 py-3 text-[13px]"
          style={{
            background: 'var(--crit-tint)',
            color: 'var(--crit)',
            border: '1px solid color-mix(in srgb, var(--crit) 25%, transparent)',
          }}
        >
          {formError}
        </div>
      )}

      <div className="flex flex-col gap-6" style={{ maxWidth: 560 }}>
        {fields.map((f) => (
          <div key={f.key} className="field">
            {!rendersOwnLabel(f) && (
              <label className="field-label" htmlFor={`f-${f.key}`}>
                {f.label}
                {f.required && <span style={{ color: 'var(--accent)' }}> *</span>}
              </label>
            )}
            <FieldInput
              field={f}
              value={values[f.key]}
              onChange={(v) => setValues((s) => ({ ...s, [f.key]: v }))}
            />
            {errors[f.key] && <span className="ferr">{errors[f.key]}</span>}
          </div>
        ))}

        {uploads?.enabled && (
          <div className="field">
            <label className="field-label">
              Documents
              {(uploads.minFiles ?? 0) > 0 && <span style={{ color: 'var(--accent)' }}> *</span>}
            </label>
            <FileDrop
              accept={uploads.accept}
              maxFiles={uploads.maxFiles}
              maxBytesPerFile={MAX_UPLOAD_BYTES}
              maxTotalBytes={MAX_TOTAL_UPLOAD_BYTES}
              files={files}
              onChange={setFiles}
              guidance={uploads.guidance}
            />
          </div>
        )}

        <Turnstile siteKey={turnstileSiteKey} onToken={setTurnstileToken} />
      </div>

      <div className="mt-8">
        <button type="submit" className="btn btn-primary" disabled={submitting}>
          {submitting && <span className="spin" aria-hidden />}
          {submitting ? 'Uploading…' : submitLabel}
        </button>
      </div>
    </form>
  );
}
