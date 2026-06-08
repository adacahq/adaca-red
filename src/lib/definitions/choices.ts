import type { ChoiceOption, ChoiceTone, FieldDef } from '@/lib/supabase/types';

export type Tone = ChoiceTone;

/** Selectable tones (the design system's semantic palette — no free hex). */
export const TONES: Tone[] = ['neutral', 'info', 'ok', 'warn', 'crit', 'accent'];

export const TONE_COLOR: Record<Tone, string> = {
  neutral: 'var(--muted)',
  info: 'var(--info)',
  ok: 'var(--ok)',
  warn: 'var(--warn)',
  crit: 'var(--crit)',
  accent: 'var(--accent)',
};

export const TONE_LABEL: Record<Tone, string> = {
  neutral: 'Neutral',
  info: 'Info',
  ok: 'Positive',
  warn: 'Warning',
  crit: 'Critical',
  accent: 'Accent',
};

/** Normalised choice: every field present. */
export interface ResolvedChoice {
  key: string;
  label: string;
  tone: Tone;
}

/** Derive a readable label from a key (`in_progress` → `In Progress`). */
export function humanizeKey(key: string): string {
  return key.replace(/_/g, ' ').replace(/\b\w/g, (m) => m.toUpperCase());
}

function resolve(raw: string | ChoiceOption): ResolvedChoice {
  if (typeof raw === 'string') return { key: raw, label: humanizeKey(raw), tone: 'neutral' };
  const key = raw.key ?? '';
  return { key, label: raw.label?.trim() || humanizeKey(key), tone: raw.tone ?? 'neutral' };
}

/** All choices of an enum field, normalised. Accepts legacy string[] configs. */
export function getChoices(field: { options?: FieldDef['options'] } | undefined): ResolvedChoice[] {
  return (field?.options?.choices ?? []).map(resolve).filter((c) => c.key);
}

/** Flat key → {label, tone} map, used by the Chip context (built from definitions). */
export type ChoiceMeta = Record<string, { label: string; tone: Tone }>;
