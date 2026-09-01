import { describe, expect, it } from 'vitest';
import { renderTokens, submissionTokens, tokenNames } from './tokens';

describe('renderTokens', () => {
  it('substitutes known tokens', () => {
    expect(renderTokens('Diagnostic #{{submission_number}}', { submission_number: 7 })).toBe(
      'Diagnostic #7',
    );
  });

  it('tolerates whitespace inside braces', () => {
    expect(renderTokens('{{ form_key }}', { form_key: 'diagnostic' })).toBe('diagnostic');
  });

  it('renders unknown tokens as empty string (never leaks the template)', () => {
    expect(renderTokens('x{{nope}}y', {})).toBe('xy');
  });

  it('leaves literal text untouched', () => {
    expect(renderTokens('no tokens here', { a: 1 })).toBe('no tokens here');
  });

  it('substitutes repeated and multiple tokens', () => {
    expect(renderTokens('{{a}}-{{b}}-{{a}}', { a: 'x', b: 'y' })).toBe('x-y-x');
  });
});

describe('tokenNames', () => {
  it('lists unique token names', () => {
    expect(tokenNames('{{a}} {{b}} {{a}}').sort()).toEqual(['a', 'b']);
  });
  it('is empty for plain text', () => {
    expect(tokenNames('plain')).toEqual([]);
  });
});

describe('submissionTokens', () => {
  it('produces the standard token set', () => {
    const t = submissionTokens({
      submissionNumber: 42,
      formKey: 'diagnostic',
      formLabel: 'Diagnostic',
      now: new Date('2026-07-04T09:30:00Z'),
    });
    expect(t.submission_number).toBe(42);
    expect(t.submission_date).toBe('2026-07-04');
    expect(t.submission_datetime).toBe('2026-07-04 09:30');
    expect(t.form_key).toBe('diagnostic');
    expect(t.form_label).toBe('Diagnostic');
  });
});
