import { describe, expect, it } from 'vitest';
import { assessFindings, assessSummaries } from './assessOutput';
import type { AssessOutput, Finding } from './types';

function finding(control: string, rating: string): Finding {
  return { control, rating, rationale: 'r', quotes: [] };
}

describe('assessFindings', () => {
  it('legacy only: flattens the flat findings map', () => {
    const assess: AssessOutput = { findings: { 'A-01': finding('A-01', 'covered') } };
    expect(assessFindings(assess)).toEqual({ 'A-01': finding('A-01', 'covered') });
  });

  it('byPrinciple only: flattens findings across principles into one map', () => {
    const assess: AssessOutput = {
      byPrinciple: {
        A: { findings: { 'A-01': finding('A-01', 'covered') } },
        B: { findings: { 'B-01': finding('B-01', 'partial') } },
      },
    };
    expect(assessFindings(assess)).toEqual({
      'A-01': finding('A-01', 'covered'),
      'B-01': finding('B-01', 'partial'),
    });
  });

  it('both present (mid-deploy): merges legacy and byPrinciple without dropping either', () => {
    const assess: AssessOutput = {
      findings: { 'A-01': finding('A-01', 'covered') },
      byPrinciple: { B: { findings: { 'B-01': finding('B-01', 'not_covered') } } },
    };
    expect(assessFindings(assess)).toEqual({
      'A-01': finding('A-01', 'covered'),
      'B-01': finding('B-01', 'not_covered'),
    });
  });

  it('undefined assess yields an empty map', () => {
    expect(assessFindings(undefined)).toEqual({});
  });
});

describe('assessSummaries', () => {
  it('legacy only: no summaries (pre-summary runs carry none)', () => {
    const assess: AssessOutput = { findings: { 'A-01': finding('A-01', 'covered') } };
    expect(assessSummaries(assess)).toEqual({});
  });

  it('byPrinciple only: maps principle key to its summary', () => {
    const assess: AssessOutput = {
      byPrinciple: {
        A: { findings: {}, summary: 'You handle bias well.' },
        B: { findings: {}, summary: 'Testing needs work.' },
      },
    };
    expect(assessSummaries(assess)).toEqual({ A: 'You handle bias well.', B: 'Testing needs work.' });
  });

  it('both present (mid-deploy): summaries come only from byPrinciple', () => {
    const assess: AssessOutput = {
      findings: { 'A-01': finding('A-01', 'covered') },
      byPrinciple: { B: { findings: {}, summary: 'ok' } },
    };
    expect(assessSummaries(assess)).toEqual({ B: 'ok' });
  });

  it('undefined assess yields an empty map', () => {
    expect(assessSummaries(undefined)).toEqual({});
  });
});
