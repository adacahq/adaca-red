import type { FieldDef, FormConfig, UploadKind } from '@/lib/supabase/types';
import { fieldsToZod } from '@/lib/definitions/zod';
import { renderTokens, type TokenValues } from './tokens';

/**
 * Pure form-config logic shared by the public submit path, the admin editor,
 * and tests (docs/workflow-forms-plan.md §5).
 */

/** The target type's fields the submitter actually sees, in display order. */
export function exposedFields(config: FormConfig, targetFields: FieldDef[]): FieldDef[] {
  const wanted = new Set(config.fields);
  return targetFields
    .filter((f) => wanted.has(f.key))
    .sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
}

/**
 * Required target-type fields that are neither exposed on the form nor given a
 * preset — a submission could never satisfy the register's schema. Surfaced as
 * a build-time warning in the admin editor and rejected at submit time.
 */
export function missingRequiredFields(config: FormConfig, targetFields: FieldDef[]): string[] {
  return targetFields
    .filter((f) => f.required)
    .filter((f) => !config.fields.includes(f.key) && !(f.key in config.presets))
    .map((f) => f.key);
}

/** Zod schema for what the submitter posts (exposed fields only). */
export function submissionSchema(config: FormConfig, targetFields: FieldDef[]) {
  return fieldsToZod(exposedFields(config, targetFields));
}

/**
 * Assemble the node `data` for a submission: validated submitter values,
 * then presets (token-rendered) — presets win so a submitter can never
 * override a preset field by posting extra keys.
 */
export function buildSubmissionData(
  config: FormConfig,
  values: Record<string, unknown>,
  tokens: TokenValues,
): Record<string, unknown> {
  const data: Record<string, unknown> = {};
  for (const key of config.fields) {
    const v = values[key];
    if (v !== undefined && v !== null && v !== '') data[key] = v;
  }
  for (const [key, template] of Object.entries(config.presets)) {
    data[key] = renderTokens(template, tokens);
  }
  return data;
}

export interface UploadRules {
  enabled: boolean;
  accept: UploadKind[];
  maxFiles: number;
  minFiles: number;
  maxBytesPerFile: number;
}

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024; // 10 MB per file
/** Total per submission: keeps 8 base64-inflated PDFs under the LLM API's
 *  32 MB request ceiling. Enforced client-side (FileDrop) and at intake. */
export const MAX_TOTAL_UPLOAD_BYTES = 20 * 1024 * 1024;

export function uploadRules(config: FormConfig): UploadRules {
  const u = config.uploads;
  return {
    enabled: !!u?.enabled,
    accept: u?.accept ?? ['pdf', 'docx'],
    maxFiles: u?.maxFiles ?? 8,
    minFiles: u?.minFiles ?? 0,
    maxBytesPerFile: MAX_UPLOAD_BYTES,
  };
}

export const MIME_BY_KIND: Record<UploadKind, string> = {
  pdf: 'application/pdf',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
};

/** Magic-byte sniff: PDFs start '%PDF'; every OOXML kind (docx/pptx/xlsx) is a
 *  zip ('PK\x03\x04') — which one is resolved by unzipping and checking the
 *  marker entry (`sniffOoxmlKind` in `documents/ooxml.ts`, server-only since
 *  it needs fflate). This module stays pure/client-safe. */
export function sniffContainer(bytes: Uint8Array): 'pdf' | 'zip' | null {
  if (bytes.length >= 4) {
    if (bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46) return 'pdf';
    if (bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 0x03 && bytes[3] === 0x04) return 'zip';
  }
  return null;
}

/** Keep the extension, strip path tricks and exotic characters. */
export function sanitiseFilename(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? 'file';
  const cleaned = base.replace(/[^\w.\- ()]/g, '_').replace(/\s+/g, ' ').trim();
  return cleaned.slice(0, 120) || 'file';
}
