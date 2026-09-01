import { describe, expect, it } from 'vitest';
import { fmtCurrency, fmtCurrencyK, fmtDate, fmtDateTime, fmtHours, formatDate } from '@/lib/format';

/** U+2212, the minus sign the formatters use — never a hyphen. */
const MINUS = '−';

describe('fmtCurrency', () => {
  it('rounds to whole dollars', () => {
    expect(fmtCurrency(0)).toBe('A$0');
    expect(fmtCurrency(980.4)).toBe('A$980');
    expect(fmtCurrency(980.5)).toBe('A$981');
  });

  it('separates thousands', () => {
    expect(fmtCurrency(1234)).toBe('A$1,234');
    expect(fmtCurrency(612000)).toBe('A$612,000');
    expect(fmtCurrency(393810)).toBe('A$393,810');
    expect(fmtCurrency(1234567)).toBe('A$1,234,567');
  });

  it('leads negatives with U+2212 before the symbol', () => {
    expect(fmtCurrency(-9918.75)).toBe(`${MINUS}A$9,919`);
    expect(fmtCurrency(-1234)).toBe(`${MINUS}A$1,234`);
    expect(fmtCurrency(-9918.75).startsWith('-')).toBe(false);
  });

  it('never renders a negative zero', () => {
    expect(fmtCurrency(-0.2)).toBe('A$0');
    expect(fmtCurrency(-0)).toBe('A$0');
  });
});

describe('fmtCurrencyK', () => {
  it('writes anything under a thousand in full', () => {
    expect(fmtCurrencyK(0)).toBe('A$0');
    expect(fmtCurrencyK(980)).toBe('A$980');
    expect(fmtCurrencyK(999.4)).toBe('A$999');
  });

  it('writes thousands in k, rounded', () => {
    expect(fmtCurrencyK(1000)).toBe('A$1k');
    expect(fmtCurrencyK(13884.75)).toBe('A$14k');
    expect(fmtCurrencyK(612000)).toBe('A$612k');
    expect(fmtCurrencyK(393810)).toBe('A$394k');
  });

  it('writes millions to two decimals', () => {
    expect(fmtCurrencyK(1230000)).toBe('A$1.23m');
    expect(fmtCurrencyK(1000000)).toBe('A$1.00m');
    // The k form would round to 1,000k, so it promotes to millions instead.
    expect(fmtCurrencyK(999600)).toBe('A$1.00m');
    expect(fmtCurrencyK(999400)).toBe('A$999k');
  });

  it('carries the sign through every threshold', () => {
    expect(fmtCurrencyK(-980)).toBe(`${MINUS}A$980`);
    expect(fmtCurrencyK(-9918.75)).toBe(`${MINUS}A$10k`);
    expect(fmtCurrencyK(-1230000)).toBe(`${MINUS}A$1.23m`);
    expect(fmtCurrencyK(-0.2)).toBe('A$0');
  });
});

describe('fmtHours', () => {
  it('separates thousands and keeps at most one decimal', () => {
    expect(fmtHours(1462)).toBe('1,462 h');
    expect(fmtHours(7.5)).toBe('7.5 h');
    expect(fmtHours(7.04)).toBe('7 h');
    expect(fmtHours(0)).toBe('0 h');
  });
});

describe('timezone determinism', () => {
  it('renders date-only strings as written, in any environment', () => {
    expect(fmtDate('2026-08-16')).toBe('16 Aug 2026');
    expect(fmtDate('2026-01-01')).toBe('01 Jan 2026');
  });
  it('renders instants in the product home zone (Sydney)', () => {
    // 08:48 UTC on 16 Aug = 18:48 AEST (+10, no DST in August)
    expect(fmtDateTime('2026-08-16T08:48:00Z')).toBe('16 Aug 2026 18:48');
    // 14:30 UTC on 20 Dec = 01:30 AEDT next day (+11)
    expect(fmtDateTime('2026-12-20T14:30:00Z')).toBe('21 Dec 2026 01:30');
  });
  it('an instant near UTC midnight keeps its Sydney calendar day', () => {
    expect(fmtDate('2026-08-16T20:00:00Z')).toBe('17 Aug 2026');
  });
});

describe('formatDate (back-compat wrapper)', () => {
  it('returns an en-dash for empty values', () => {
    expect(formatDate(null)).toBe('–');
    expect(formatDate(undefined)).toBe('–');
    expect(formatDate('')).toBe('–');
  });
  it('echoes back input that does not parse as a date', () => {
    expect(formatDate('garbage')).toBe('garbage');
  });
});
