import { describe, expect, it } from 'vitest';
import { reportEmailHtml } from './index';

describe('reportEmailHtml', () => {
  const base = {
    title: 'AI Deployer Baseline Diagnostic',
    verdict: 'amber' as const,
    verdictLabel: 'Amber',
    summary: 'Based on 2 documents.',
    reportUrl: 'https://red.example/d/r/abc123',
    ctas: [{ label: 'Book a review', href: 'https://example.com/book' }],
  };

  it('carries the report link, verdict and CTAs', () => {
    const html = reportEmailHtml(base);
    expect(html).toContain('https://red.example/d/r/abc123');
    expect(html).toContain('Amber');
    expect(html).toContain('Book a review');
  });

  it('escapes HTML in every interpolated string (submitter-controlled data)', () => {
    const html = reportEmailHtml({
      ...base,
      title: '<script>alert(1)</script>',
      summary: 'a & b <img>',
      ctas: [{ label: '<b>x</b>', href: 'https://e.com/?a=1&b="2"' }],
    });
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
    expect(html).toContain('a &amp; b &lt;img&gt;');
    expect(html).not.toContain('<b>x</b>');
    expect(html).toContain('&quot;2&quot;');
  });

  it('falls back to the amber hue for unknown verdicts', () => {
    const html = reportEmailHtml({ ...base, verdict: 'weird' as never });
    expect(html).toContain('#d9a13b');
  });
});
