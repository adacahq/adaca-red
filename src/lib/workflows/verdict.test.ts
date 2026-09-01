import { describe, expect, it } from 'vitest';
import type { RubricConfig } from '@/lib/supabase/types';
import { computeVerdict } from './verdict';
import type { AssessOutput, Finding } from './types';

const RUBRIC: RubricConfig = {
  ratings: [
    { key: 'covered', label: 'Covered', score: 2, tone: 'ok' },
    { key: 'partial', label: 'Partial', score: 1, tone: 'warn' },
    { key: 'not_covered', label: 'Not covered', score: 0, tone: 'crit' },
    { key: 'not_applicable', label: 'N/A', score: null, tone: 'neutral' },
  ],
  principles: [
    {
      key: 'A',
      label: 'Alpha',
      controls: [
        { key: 'A-01', label: 'a1', description: '' },
        { key: 'A-02', label: 'a2', description: '' },
      ],
    },
    {
      key: 'B',
      label: 'Beta',
      controls: [{ key: 'B-01', label: 'b1', description: '', weight: 2 }],
    },
  ],
};

const THRESHOLDS = { green: 0.8, amber: 0.5 };

function finding(control: string, rating: string): Finding {
  return { control, rating, rationale: 'r', quotes: [] };
}

function assess(entries: [string, string][]): AssessOutput {
  return { findings: Object.fromEntries(entries.map(([c, r]) => [c, finding(c, r)])) };
}

describe('computeVerdict', () => {
  it('full coverage is green with coverage 1', () => {
    const v = computeVerdict(
      RUBRIC,
      assess([
        ['A-01', 'covered'],
        ['A-02', 'covered'],
        ['B-01', 'covered'],
      ]),
      THRESHOLDS,
      ['policy.pdf'],
    );
    expect(v.verdict).toBe('green');
    expect(v.coverage).toBe(1);
    expect(v.counts).toMatchObject({ covered: 3, partial: 0, notCovered: 0, notApplicable: 0, total: 3 });
  });

  it('weights count: the weight-2 control drags coverage harder', () => {
    // A-01 covered(2) + A-02 covered(2) + B-01 not_covered(0, weight 2)
    // num = 2+2+0 = 4; den = 2+2+4 = 8 → 0.5 → amber (boundary).
    const v = computeVerdict(
      RUBRIC,
      assess([
        ['A-01', 'covered'],
        ['A-02', 'covered'],
        ['B-01', 'not_covered'],
      ]),
      THRESHOLDS,
      [],
    );
    expect(v.coverage).toBe(0.5);
    expect(v.verdict).toBe('amber');
  });

  it('below the amber threshold is red', () => {
    const v = computeVerdict(
      RUBRIC,
      assess([
        ['A-01', 'partial'],
        ['A-02', 'not_covered'],
        ['B-01', 'not_covered'],
      ]),
      THRESHOLDS,
      [],
    );
    expect(v.coverage).toBeLessThan(0.5);
    expect(v.verdict).toBe('red');
  });

  it('a control with NO finding counts as zero — unassessed is not a pass', () => {
    const v = computeVerdict(RUBRIC, assess([['A-01', 'covered']]), THRESHOLDS, []);
    // num = 2; den = 8 → 0.25.
    expect(v.coverage).toBe(0.25);
    expect(v.counts.notCovered).toBe(2);
  });

  it('not_applicable drops out of both sides of the ratio', () => {
    const v = computeVerdict(
      RUBRIC,
      assess([
        ['A-01', 'covered'],
        ['A-02', 'covered'],
        ['B-01', 'not_applicable'],
      ]),
      THRESHOLDS,
      [],
    );
    expect(v.coverage).toBe(1); // 4/4 — B-01 excluded entirely
    expect(v.verdict).toBe('green');
    expect(v.counts.notApplicable).toBe(1);
  });

  it('an empty rubric yields red with zero coverage, not NaN', () => {
    const empty: RubricConfig = { ratings: RUBRIC.ratings, principles: [] };
    const v = computeVerdict(empty, { findings: {} }, THRESHOLDS, []);
    expect(v.coverage).toBe(0);
    expect(v.verdict).toBe('red');
  });

  it('computes identically when findings arrive via byPrinciple (new parallel-assess shape)', () => {
    const v = computeVerdict(
      RUBRIC,
      {
        byPrinciple: {
          A: {
            findings: {
              'A-01': finding('A-01', 'covered'),
              'A-02': finding('A-02', 'covered'),
            },
          },
          B: { findings: { 'B-01': finding('B-01', 'covered') } },
        },
      },
      THRESHOLDS,
      ['policy.pdf'],
    );
    expect(v.verdict).toBe('green');
    expect(v.coverage).toBe(1);
    expect(v.counts).toMatchObject({ covered: 3, partial: 0, notCovered: 0, notApplicable: 0, total: 3 });
  });

  it('docsLine names the documents and the applicable-control counts', () => {
    const v = computeVerdict(
      RUBRIC,
      assess([
        ['A-01', 'covered'],
        ['A-02', 'partial'],
        ['B-01', 'not_applicable'],
      ]),
      THRESHOLDS,
      ['ai-policy.pdf', 'risk-framework.docx'],
    );
    expect(v.docsLine).toContain('2 documents');
    expect(v.docsLine).toContain('ai-policy.pdf');
    expect(v.docsLine).toContain('Of 2 applicable controls');
    expect(v.docsLine).toContain('1 not applicable');
  });
});
