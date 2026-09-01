interface SectionHeaderProps {
  /**
   * The proper section title. Renders as the prominent h3 heading.
   * Keep to 1-3 words: the genuine name of the section as a reader
   * would say it out loud (e.g. "Network", "Referrals", "Pricing").
   */
  title: string;
  /**
   * Optional mono uppercase zone label, read before the title
   * (e.g. "Reports"). Skip if the title alone does the job.
   */
  eyebrow?: string;
  /** Anchor id for in-page navigation. Pair with a `Toc` above. */
  id?: string;
}

/**
 * The "file header" that opens a section: an optional mono zone label, the
 * title, then a hairline rule filling the remaining width. Used as a
 * replacement for `### h3` markdown headings throughout content sections.
 * Pass `id` to make it an anchor target (lands below the sticky topbar via
 * scroll-mt-20).
 */
export default function SectionHeader({ title, eyebrow, id }: SectionHeaderProps) {
  return (
    <header id={id} className="mt-16 mb-8 flex items-center gap-4 scroll-mt-20">
      {eyebrow && (
        <span className="zone-label" style={{ flexShrink: 0 }}>
          {eyebrow}
        </span>
      )}
      <h3
        style={{
          flexShrink: 0,
          fontSize: 20,
          fontWeight: 500,
          color: 'var(--fg)',
          letterSpacing: '-0.01em',
          margin: 0,
          lineHeight: 1.2,
        }}
      >
        {title}
      </h3>
      <span aria-hidden className="flex-1" style={{ height: 1, background: 'var(--line)' }} />
    </header>
  );
}
