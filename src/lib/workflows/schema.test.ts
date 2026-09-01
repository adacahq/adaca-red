import { describe, expect, it } from 'vitest';
import type { RubricConfig } from '@/lib/supabase/types';
import { coherenceSchema, principleFindingsSchema, ratingKeys } from './schema';
import { STEP_LABELS, totalUnits, unitsDone } from './types';
import type { WorkflowConfig } from '@/lib/supabase/types';

const RUBRIC: RubricConfig = {
  ratings: [
    { key: 'covered', label: 'Covered', score: 2, tone: 'ok' },
    { key: 'not_covered', label: 'Not covered', score: 0, tone: 'crit' },
  ],
  principles: [
    {
      key: 'FA',
      label: 'Fairness',
      controls: [
        { key: 'FA-01', label: 'Policy', description: 'd' },
        { key: 'FA-02', label: 'Bias', description: 'd' },
      ],
    },
    { key: 'RS', label: 'Reliability', controls: [{ key: 'RS-01', label: 'Testing', description: 'd' }] },
  ],
};

describe('principleFindingsSchema (derived from the rubric)', () => {
  const schema = principleFindingsSchema(RUBRIC, RUBRIC.principles[0]) as {
    properties: {
      findings: {
        items: {
          properties: { control: { enum: string[] }; rating: { enum: string[] } };
          required: string[];
          additionalProperties: boolean;
        };
      };
      summary: { type: string; description?: string };
    };
    additionalProperties: boolean;
    required: string[];
  };

  it('enumerates exactly the principle’s control keys', () => {
    expect(schema.properties.findings.items.properties.control.enum).toEqual(['FA-01', 'FA-02']);
  });

  it('enumerates exactly the rubric’s rating keys', () => {
    expect(schema.properties.findings.items.properties.rating.enum).toEqual(['covered', 'not_covered']);
  });

  it('honours structured-outputs constraints (additionalProperties false + required)', () => {
    expect(schema.additionalProperties).toBe(false);
    expect(schema.required).toEqual(['findings', 'summary']);
    expect(schema.properties.findings.items.additionalProperties).toBe(false);
    expect(schema.properties.findings.items.required).toEqual([
      'control',
      'rating',
      'rationale',
      'quotes',
    ]);
  });

  it('requires a plain-language summary, guided (via description) to never cite control IDs', () => {
    expect(schema.properties.summary.type).toBe('string');
    expect(schema.properties.summary.description).toMatch(/control ID/i);
  });

  it('editing the rubric reshapes the schema (the definitions-driven promise)', () => {
    const grown: RubricConfig = {
      ...RUBRIC,
      principles: [
        {
          ...RUBRIC.principles[0],
          controls: [...RUBRIC.principles[0].controls, { key: 'FA-03', label: 'New', description: 'd' }],
        },
      ],
    };
    const next = principleFindingsSchema(grown, grown.principles[0]) as typeof schema;
    expect(next.properties.findings.items.properties.control.enum).toContain('FA-03');
  });
});

describe('coherenceSchema', () => {
  it('requires all three outputs', () => {
    const s = coherenceSchema() as { required: string[]; additionalProperties: boolean };
    expect(s.required).toEqual(['contradictions', 'paper_vs_practice', 'summary']);
    expect(s.additionalProperties).toBe(false);
  });
});

describe('ratingKeys', () => {
  it('lists rating keys in declared order', () => {
    expect(ratingKeys(RUBRIC)).toEqual(['covered', 'not_covered']);
  });
});

describe('run-unit arithmetic (progress bar)', () => {
  const WORKFLOW: WorkflowConfig = {
    resultType: 'assessment',
    steps: [
      { type: 'extract' },
      { type: 'assess', config: { rubric: 'r' } },
      { type: 'coherence' },
      { type: 'verdict', config: { thresholds: { green: 0.8, amber: 0.5 } } },
      {
        type: 'report',
        config: { sections: [
          { key: 'a', title: 'A', source: 'verdict' },
          { key: 'b', title: 'B', source: 'llm' },
          { key: 'c', title: 'C', source: 'llm' },
        ] },
      },
      { type: 'notify', config: { subject: 's', ctas: [] } },
    ],
  };

  it('totals one unit per step, except assess (per principle) and report (per section)', () => {
    // 1 + 2 principles + 1 + 1 + 3 sections + 1 = 9
    expect(totalUnits(WORKFLOW, RUBRIC)).toBe(9);
  });

  it('unitsDone counts completed steps plus the within-step done count', () => {
    expect(unitsDone(WORKFLOW, RUBRIC, 0, 0)).toBe(0);
    expect(unitsDone(WORKFLOW, RUBRIC, 1, 1)).toBe(2); // extract + 1 principle done
    expect(unitsDone(WORKFLOW, RUBRIC, 4, 2)).toBe(7); // through verdict + 2 sections done
    expect(unitsDone(WORKFLOW, RUBRIC, 6, 0)).toBe(9); // complete
  });

  it('unitsDone: mid-assess with 3 of 6 principles done (parallel sub-units)', () => {
    const rubric6: RubricConfig = {
      ratings: RUBRIC.ratings,
      principles: Array.from({ length: 6 }, (_, i) => ({
        key: `P${i}`,
        label: `Principle ${i}`,
        controls: [{ key: `P${i}-01`, label: 'x', description: 'd' }],
      })),
    };
    const wf: WorkflowConfig = {
      resultType: 'assessment',
      steps: [{ type: 'extract' }, { type: 'assess', config: { rubric: 'r' } }],
    };
    // stepIndex 1 (assess, still the current step) with 3 of 6 subs done.
    expect(unitsDone(wf, rubric6, 1, 3)).toBe(1 + 3);
  });

  it('unitsDone: report step with 2 of 4 sections done (parallel sub-units)', () => {
    const wf: WorkflowConfig = {
      resultType: 'assessment',
      steps: [
        { type: 'extract' },
        { type: 'coherence' },
        {
          type: 'report',
          config: {
            sections: [
              { key: 'a', title: 'A', source: 'verdict' },
              { key: 'b', title: 'B', source: 'llm' },
              { key: 'c', title: 'C', source: 'llm' },
              { key: 'd', title: 'D', source: 'llm' },
            ],
          },
        },
      ],
    };
    // stepIndex 2 (report, still the current step) with 2 of 4 sections done.
    expect(unitsDone(wf, null, 2, 2)).toBe(2 + 2);
  });

  it('every step type has a public-facing label', () => {
    for (const step of WORKFLOW.steps) expect(STEP_LABELS[step.type]).toBeTruthy();
  });
});
