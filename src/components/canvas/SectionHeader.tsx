interface SectionHeaderProps {
  /**
   * The proper section title. Renders as the prominent h3 heading.
   * Keep to 1-3 words: the genuine name of the section as a reader
   * would say it out loud (e.g. "Network", "Referrals", "Pricing").
   */
  title: string;
  /**
   * Optional smaller mono uppercase line. Carries a tad more
   * descriptive context (e.g. "Your network first", "Six touches
   * over 15 business days"). Skip if the title alone does the job.
   */
  eyebrow?: string;
  /** Anchor id for in-page navigation. Pair with a `Toc` above. */
  id?: string;
  /**
   * Where the eyebrow renders relative to the title. Default 'above'.
   * Use 'below' as an editorial variant where the section name leads
   * and the descriptive line trails as context.
   */
  eyebrowPosition?: 'above' | 'below';
}

/**
 * Editorial-style section header. Optional mono uppercase eyebrow (above
 * or below the title), the proper section title as the heading, hairline
 * rule beneath. Used as a replacement for `### h3` markdown headings
 * throughout content sections. Pass `id` to make it an anchor target
 * (lands below the sticky topbar via scroll-mt-20).
 */
export default function SectionHeader({
  title,
  eyebrow,
  id,
  eyebrowPosition = 'above',
}: SectionHeaderProps) {
  const eyebrowEl = eyebrow ? (
    <p
      className="mono"
      style={{
        fontSize: 11,
        fontWeight: 500,
        letterSpacing: '0.16em',
        color: 'var(--accent)',
        textTransform: 'uppercase',
        margin: 0,
      }}
    >
      {eyebrow}
    </p>
  ) : null;

  const titleEl = (
    <h3
      style={{
        fontSize: 22,
        fontWeight: 500,
        color: 'var(--ink)',
        letterSpacing: '-0.01em',
        margin: 0,
        lineHeight: 1.2,
      }}
    >
      {title}
    </h3>
  );

  return (
    <header id={id} className="mt-16 mb-8 scroll-mt-20">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {eyebrowPosition === 'above' && eyebrowEl}
        {titleEl}
        {eyebrowPosition === 'below' && eyebrowEl}
      </div>
      <span
        aria-hidden
        style={{
          display: 'block',
          height: 1,
          background: 'var(--line)',
          marginTop: 18,
        }}
      />
    </header>
  );
}
