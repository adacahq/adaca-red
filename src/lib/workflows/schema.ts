import type { RubricConfig, RubricPrinciple } from '@/lib/supabase/types';

/**
 * JSON Schemas for the LLM's structured outputs, DERIVED from the rubric
 * config — editing the standard in Admin → Rubrics automatically reshapes what
 * the model must return. Pure functions (unit-tested).
 *
 * Structured-outputs constraints honoured: objects declare
 * `additionalProperties: false` + `required`; no numeric/string constraints.
 */

export function ratingKeys(rubric: RubricConfig): string[] {
  return rubric.ratings.map((r) => r.key);
}

/** Schema for one principle's findings (one assess call). */
export function principleFindingsSchema(
  rubric: RubricConfig,
  principle: RubricPrinciple,
): Record<string, unknown> {
  return {
    type: 'object',
    additionalProperties: false,
    required: ['findings', 'summary'],
    properties: {
      findings: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['control', 'rating', 'rationale', 'quotes'],
          properties: {
            control: { type: 'string', enum: principle.controls.map((c) => c.key) },
            rating: { type: 'string', enum: ratingKeys(rubric) },
            rationale: { type: 'string' },
            quotes: {
              type: 'array',
              items: {
                type: 'object',
                additionalProperties: false,
                required: ['document', 'quote'],
                properties: {
                  document: { type: 'string' },
                  quote: { type: 'string' },
                },
              },
            },
          },
        },
      },
      summary: {
        type: 'string',
        description:
          'Two to three plain-language sentences for a business reader: what this principle\'s ' +
          'findings mean for your organisation and the single highest-priority next step. Never cite ' +
          'control IDs or codes (e.g. "FA-01") — describe the gap or strength in plain terms.',
      },
    },
  };
}

/** Schema for the cross-document coherence check. */
export function coherenceSchema(): Record<string, unknown> {
  return {
    type: 'object',
    additionalProperties: false,
    required: ['contradictions', 'paper_vs_practice', 'summary'],
    properties: {
      contradictions: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['documents', 'description'],
          properties: {
            documents: { type: 'array', items: { type: 'string' } },
            description: { type: 'string' },
          },
        },
      },
      paper_vs_practice: { type: 'string' },
      summary: { type: 'string' },
    },
  };
}
