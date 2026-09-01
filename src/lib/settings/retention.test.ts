import { describe, expect, it } from 'vitest';
import { DEFAULT_RETENTION, isExpired, resolveRetention, retentionCopy } from './retention';

const NOW = new Date('2026-07-04T12:00:00Z');

describe('resolveRetention', () => {
  it('per-form override wins over the app setting', () => {
    const got = resolveRetention(
      'submission',
      { mode: 'days', days: 7 },
      { retention: { submission: { mode: 'off' } } },
    );
    expect(got).toEqual({ mode: 'off' });
  });

  it('app setting wins over defaults', () => {
    expect(resolveRetention('submission', { mode: 'days', days: 30 }, null)).toEqual({
      mode: 'days',
      days: 30,
    });
  });

  it('falls back to shipped defaults', () => {
    expect(resolveRetention('submission', undefined, null)).toEqual(DEFAULT_RETENTION.submission);
    expect(resolveRetention('assessment', undefined, undefined)).toEqual(DEFAULT_RETENTION.assessment);
  });
});

describe('isExpired', () => {
  it('persist never expires', () => {
    expect(isExpired({ mode: 'persist' }, '2000-01-01T00:00:00Z', NOW)).toBe(false);
  });

  it('a missing clock start never expires (in-flight runs are held)', () => {
    expect(isExpired({ mode: 'off' }, null, NOW)).toBe(false);
    expect(isExpired({ mode: 'days', days: 1 }, undefined, NOW)).toBe(false);
  });

  it('off expires as soon as the clock starts', () => {
    expect(isExpired({ mode: 'off' }, '2026-07-04T11:59:00Z', NOW)).toBe(true);
    expect(isExpired({ mode: 'off' }, '2026-07-04T12:01:00Z', NOW)).toBe(false);
  });

  it('days expires exactly N days after the clock start', () => {
    const setting = { mode: 'days' as const, days: 1 };
    expect(isExpired(setting, '2026-07-03T12:00:00Z', NOW)).toBe(true); // boundary
    expect(isExpired(setting, '2026-07-03T12:00:01Z', NOW)).toBe(false);
    expect(isExpired({ mode: 'days', days: 7 }, '2026-06-26T00:00:00Z', NOW)).toBe(true);
  });

  it('an unparseable clock never expires', () => {
    expect(isExpired({ mode: 'off' }, 'not-a-date', NOW)).toBe(false);
  });
});

describe('retentionCopy', () => {
  it('describes the 24-hour default', () => {
    const copy = retentionCopy({ mode: 'days', days: 1 }, { mode: 'persist' });
    expect(copy).toContain('24 hours');
    expect(copy).toContain('link keeps working');
  });

  it('describes zero retention', () => {
    expect(retentionCopy({ mode: 'off' }, { mode: 'persist' })).toContain(
      'deleted as soon as your assessment completes',
    );
  });

  it('describes N-day retention', () => {
    expect(retentionCopy({ mode: 'days', days: 7 }, { mode: 'days', days: 90 })).toContain('7 days');
  });
});
