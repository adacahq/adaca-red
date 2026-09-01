/**
 * Token templates for form presets and workflow copy
 * (docs/workflow-forms-plan.md §5). Pure string logic — values are supplied by
 * the caller; unknown tokens resolve to '' rather than leaking the template.
 */

const TOKEN_RE = /\{\{\s*([a-z0-9_]+)\s*\}\}/gi;

export type TokenValues = Record<string, string | number | undefined>;

export function renderTokens(template: string, values: TokenValues): string {
  return template.replace(TOKEN_RE, (_, name: string) => {
    const v = values[name];
    return v === undefined || v === null ? '' : String(v);
  });
}

/** Token names referenced by a template (for admin-editor validation). */
export function tokenNames(template: string): string[] {
  const names = new Set<string>();
  for (const m of template.matchAll(TOKEN_RE)) names.add(m[1]);
  return [...names];
}

/** The standard token set available to form presets. */
export function submissionTokens(input: {
  submissionNumber: number;
  formKey: string;
  formLabel: string;
  now?: Date;
}): TokenValues {
  const now = input.now ?? new Date();
  const iso = now.toISOString();
  return {
    submission_number: input.submissionNumber,
    submission_date: iso.slice(0, 10),
    submission_datetime: iso.slice(0, 16).replace('T', ' '),
    form_key: input.formKey,
    form_label: input.formLabel,
  };
}
