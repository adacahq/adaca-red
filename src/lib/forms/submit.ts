import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, Json } from '@/lib/supabase/types';
import { sniffOoxmlKind, storeDocument } from '@/lib/documents/server';
import { initialRunState } from '@/lib/workflows/runner';
import {
  buildSubmissionData,
  MAX_TOTAL_UPLOAD_BYTES,
  missingRequiredFields,
  MIME_BY_KIND,
  sanitiseFilename,
  sniffContainer,
  submissionSchema,
  uploadRules,
} from './config';
import type { LoadedForm } from './server';
import { submissionTokens } from './tokens';

/**
 * The public submission path (docs/workflow-forms-plan.md §5). Runs ONLY under
 * the service-role client — `anon` has zero grants — after the route handler
 * has verified Turnstile. Every input here is hostile: values are re-validated
 * against the target type's schema and files are magic-byte checked.
 */

export class SubmissionError extends Error {
  constructor(
    message: string,
    readonly status = 400,
  ) {
    super(message);
  }
}

export interface IncomingFile {
  filename: string;
  bytes: Uint8Array;
}

export async function createSubmission(
  db: SupabaseClient<Database>,
  form: LoadedForm,
  rawValues: unknown,
  files: IncomingFile[],
): Promise<{ id: string }> {
  const { config, target, targetConfig } = form;

  // A misconfigured form must fail loudly, not create invalid register rows.
  const missing = missingRequiredFields(config, targetConfig.fields ?? []);
  if (missing.length > 0) {
    throw new SubmissionError(
      `This form is misconfigured (unset required fields: ${missing.join(', ')}). Please try again later.`,
      500,
    );
  }

  const parsed = submissionSchema(config, targetConfig.fields ?? []).safeParse(rawValues ?? {});
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    throw new SubmissionError(
      `Check ${String(first?.path[0] ?? 'the form')}: ${first?.message ?? 'invalid value'}`,
    );
  }
  const values: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(parsed.data as Record<string, unknown>)) {
    values[k] = v instanceof Date ? v.toISOString().slice(0, 10) : v;
  }

  // Files: count, per-file size, total size, extension + magic bytes.
  const rules = uploadRules(config);
  const checked: { filename: string; mime: string; bytes: Uint8Array }[] = [];
  if (rules.enabled) {
    if (files.length < rules.minFiles) {
      throw new SubmissionError(
        `Please attach at least ${rules.minFiles} document${rules.minFiles === 1 ? '' : 's'}.`,
      );
    }
    if (files.length > rules.maxFiles) {
      throw new SubmissionError(`At most ${rules.maxFiles} documents are allowed.`);
    }
    let total = 0;
    for (const f of files) {
      total += f.bytes.byteLength;
      if (f.bytes.byteLength > rules.maxBytesPerFile) {
        throw new SubmissionError(`${f.filename} is too large (10 MB max per file).`);
      }
      const container = sniffContainer(f.bytes);
      const kind = container === 'pdf' ? 'pdf' : container === 'zip' ? sniffOoxmlKind(f.bytes) : null;
      if (!kind || !rules.accept.includes(kind)) {
        throw new SubmissionError(`${f.filename} isn't a ${rules.accept.join('/').toUpperCase()} file.`);
      }
      checked.push({ filename: sanitiseFilename(f.filename), mime: MIME_BY_KIND[kind], bytes: f.bytes });
    }
    if (total > MAX_TOTAL_UPLOAD_BYTES) {
      throw new SubmissionError('The documents together exceed the 20 MB total limit.');
    }
  } else if (files.length > 0) {
    throw new SubmissionError('This form does not accept file uploads.');
  }

  // Token presets (race-safe per-form sequence) + assembled node data.
  const { data: seq, error: seqErr } = await db.rpc('next_counter', {
    p_key: `form:${form.def.key}`,
  });
  if (seqErr) throw seqErr;
  const tokens = submissionTokens({
    submissionNumber: (seq as unknown as number) ?? 0,
    formKey: form.def.key,
    formLabel: form.def.label,
  });
  const data = buildSubmissionData(config, values, tokens);
  if (checked.length > 0) data.document_names = checked.map((c) => c.filename).join(', ');
  if (config.workflow) data.run = initialRunState(config.workflow) as unknown as Json;

  const { data: id, error } = await db.rpc('save_node', {
    p_id: null,
    p_type: target.key,
    p_parent: null,
    p_data: data as Json,
    p_position: 0,
    p_change_note: `Public submission via form "${form.def.key}"`,
  });
  if (error) throw error;
  const nodeId = id as unknown as string;

  for (const f of checked) {
    await storeDocument(db, { nodeId, filename: f.filename, mimeType: f.mime, bytes: f.bytes });
  }

  return { id: nodeId };
}

/** Cloudflare Turnstile verification. No secret configured = open (dev parity,
 *  same convention as the worker's Basic Auth gate). */
export async function verifyTurnstile(token: string | null, ip: string | null): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) return true;
  if (!token) return false;
  const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ secret, response: token, ...(ip ? { remoteip: ip } : {}) }),
  });
  if (!res.ok) return false;
  const body = (await res.json()) as { success?: boolean };
  return !!body.success;
}
