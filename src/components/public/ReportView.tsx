import type { CSSProperties, MouseEvent } from 'react';
import SectionHeader from '@/components/canvas/SectionHeader';
import Toc, { type TocItem } from '@/components/canvas/Toc';
import RichTextView from '@/components/rich-text/RichTextView';
import { fmtDate } from '@/lib/format';
import { TONE_COLOR } from '@/lib/definitions/choices';
import type { RubricRating } from '@/lib/supabase/types';
import type {
  CoherenceOutput,
  Finding,
  ReportOutput,
  ReportSectionOutput,
  VerdictOutput,
} from '@/lib/workflows/types';
import FindingsTabs from './FindingsTabs';
import VerdictTiles from './VerdictTiles';

/** The assessment node's `data` — everything the report needs, standalone. */
export interface AssessmentData {
  title?: string;
  form_label?: string;
  verdict?: 'green' | 'amber' | 'red';
  submitted_at?: string;
  document_names?: string;
  findings?: Record<string, Finding>;
  /** Principle key → "what this means for you", shown when a findings section's showSummaries is set. */
  summaries?: Record<string, string>;
  coherence?: CoherenceOutput | null;
  verdict_detail?: VerdictOutput;
  report?: ReportOutput;
  ctas?: { label: string; href: string }[];
  rubric_snapshot?: {
    ratings: RubricRating[];
    principles: FindingsGroup[];
  } | null;
}

/** One rubric principle's findings group: label + its controls. Shared shape
 *  between the stacked FindingsSection and FindingsTabs (workflows/types.ts's
 *  rubric_snapshot.principles already matches this exactly). */
export interface FindingsGroup {
  key: string;
  label: string;
  controls: { key: string; label: string }[];
}

const VERDICT_TONE: Record<string, string> = {
  green: 'var(--ok)',
  amber: 'var(--warn)',
  red: 'var(--crit)',
};

/** Verdict key → `.rag` modifier class (globals.css already speaks RAG). */
const RAG_CLASS: Record<string, string> = { green: 'g', amber: 'a', red: 'r' };

/** Report section kind → the `.zone-label` read before its title. */
const SECTION_KIND_LABEL: Record<ReportSectionOutput['kind'], string> = {
  verdict: 'Verdict',
  findings: 'Findings',
  coherence: 'Coherence',
  prose: 'Guidance',
};

/** Shared (sync) report renderer — used by the public report page. */
export default function ReportView({ data, issuedAt }: { data: AssessmentData; issuedAt: string }) {
  const verdict = data.verdict ?? 'amber';
  const hue = VERDICT_TONE[verdict] ?? 'var(--warn)';
  const detail = data.verdict_detail;
  const sections = data.report?.sections ?? [];

  return (
    <article>
      <p className="eyebrow rv">Diagnostic</p>
      <h1 className="view-title rv" style={{ '--i': 1 } as CSSProperties}>
        {data.title ?? 'Assessment report'}
      </h1>
      <p className="lede rv" style={{ '--i': 2 } as CSSProperties}>
        {data.form_label ?? 'Assessment'} · Issued {fmtDate(issuedAt)}
      </p>

      {/* Verdict banner */}
      <div className="chart-card mt-10 mb-10">
        <p className="flex items-center gap-2.5 mb-2">
          <span aria-hidden className={`rag ${RAG_CLASS[verdict] ?? 'a'}`} />
          <span className="mono" style={{ fontSize: 18, letterSpacing: '0.1em', textTransform: 'uppercase', color: hue }}>
            {verdict}
          </span>
          {detail && (
            <span className="mono" style={{ fontSize: 15, color: 'var(--muted)' }}>
              · {(detail.coverage * 100).toFixed(0)}% coverage
            </span>
          )}
        </p>
        {detail?.docsLine && (
          <p className="text-[15px]" style={{ color: 'var(--muted)', lineHeight: 1.7 }}>{detail.docsLine}</p>
        )}
      </div>

      {sections.map((s) =>
        s.collapsed ? (
          <section key={s.key} className="mb-10">
            <details className="acc">
              <summary>
                <span className="flex items-center gap-3">
                  <span className="zone-label" style={{ flexShrink: 0 }}>{SECTION_KIND_LABEL[s.kind]}</span>
                  <span style={{ fontSize: 20, fontWeight: 500, color: 'var(--fg)', letterSpacing: '-0.01em' }}>
                    {s.title}
                  </span>
                </span>
                <span aria-hidden className="pl">+</span>
              </summary>
              <div className="abody">
                <SectionBody section={s} data={data} detail={detail} />
              </div>
            </details>
          </section>
        ) : (
          <section key={s.key} className="mb-10">
            <SectionHeader title={s.title} eyebrow={SECTION_KIND_LABEL[s.kind]} />
            <SectionBody section={s} data={data} detail={detail} />
          </section>
        ),
      )}

      {(data.ctas?.length ?? 0) > 0 && (
        <section className="mt-12">
          <SectionHeader title="Next steps" />
          <div className="flex flex-wrap gap-3">
            {data.ctas!.map((c, i) => (
              <a
                key={c.href}
                href={c.href}
                className={i === 0 ? 'btn btn-primary' : 'btn btn-ghost'}
              >
                {c.label}
              </a>
            ))}
          </div>
        </section>
      )}

      <p className="mt-14 text-[14px]" style={{ color: 'var(--muted)', lineHeight: 1.7 }}>
        This report is automated guidance based solely on the documents provided; it is not
        legal advice. Keep this link private: anyone with it can read the report.
      </p>
    </article>
  );
}

/** The kind-specific body for one report section — shared by the collapsed and open renderings. */
function SectionBody({
  section,
  data,
  detail,
}: {
  section: ReportSectionOutput;
  data: AssessmentData;
  detail?: VerdictOutput;
}) {
  // Measure clamp: LLM-composed prose (gaps/readiness/next-steps sections)
  // stays ~70ch readable at the wider canvas; findings/verdict/coherence
  // are row- or tile-based, not prose, so they span the full width.
  if (section.kind === 'prose') {
    return (
      <div style={{ maxWidth: 680 }}>
        <RichTextView value={section.markdown} />
      </div>
    );
  }
  if (section.kind === 'verdict') {
    return <VerdictSection detail={detail} display={section.display} snapshot={data.rubric_snapshot} findings={data.findings ?? {}} />;
  }
  if (section.kind === 'findings') {
    // 'tabs' needs the snapshot's principle groups to have anything to tab
    // over; no snapshot (shouldn't happen once an assess step has run, but
    // defensive) falls back to the stacked layout, same as FindingsSection's
    // own flat-list fallback.
    if (section.display === 'tabs' && (data.rubric_snapshot?.principles.length ?? 0) > 0) {
      return (
        <FindingsTabs
          groups={data.rubric_snapshot!.principles}
          findings={data.findings ?? {}}
          summaries={data.summaries ?? {}}
          ratings={data.rubric_snapshot!.ratings}
          showControlIds={section.showControlIds}
          showSummaries={section.showSummaries}
        />
      );
    }
    return <FindingsSection data={data} showControlIds={section.showControlIds} showSummaries={section.showSummaries} />;
  }
  if (section.kind === 'coherence') return <CoherenceSection coherence={data.coherence ?? undefined} />;
  return null;
}

function VerdictSection({
  detail,
  display,
  snapshot,
  findings,
}: {
  detail?: VerdictOutput;
  // 'tabs' is only meaningful for findings sections; a verdict section never
  // sets it, but the type is shared (ReportSectionOutput.display) — treated
  // the same as 'inline' here (falls through to the default row below).
  display?: 'inline' | 'tiles' | 'tabs';
  snapshot?: AssessmentData['rubric_snapshot'];
  findings?: Record<string, Finding>;
}) {
  if (!detail) return <p style={{ color: 'var(--muted)' }}>–</p>;

  if (display === 'tiles') {
    return (
      <VerdictTiles
        counts={detail.counts}
        ratings={snapshot?.ratings ?? []}
        groups={snapshot?.principles ?? []}
        findings={findings ?? {}}
      />
    );
  }

  const rows: { label: string; value: number; tone: string }[] = [
    { label: 'Fully covered', value: detail.counts.covered, tone: 'var(--ok)' },
    { label: 'Partially covered', value: detail.counts.partial, tone: 'var(--warn)' },
    { label: 'Not covered', value: detail.counts.notCovered, tone: 'var(--crit)' },
    { label: 'Not applicable', value: detail.counts.notApplicable, tone: 'var(--muted)' },
  ];
  return (
    <div className="stats">
      {rows.map((r) => (
        <div key={r.label} className="stat">
          <b style={{ color: r.tone }}>{r.value}</b>
          <span>{r.label}</span>
        </div>
      ))}
    </div>
  );
}

function FindingsSection({
  data,
  showControlIds = true,
  showSummaries = false,
}: {
  data: AssessmentData;
  showControlIds?: boolean;
  showSummaries?: boolean;
}) {
  const findings = data.findings ?? {};
  const summaries = data.summaries ?? {};
  const snapshot = data.rubric_snapshot;
  const ratingMeta = new Map((snapshot?.ratings ?? []).map((r) => [r.key, r]));

  // Group by principle when the snapshot exists; else a flat list.
  const groups: FindingsGroup[] =
    snapshot?.principles ?? [
      { key: 'all', label: 'Findings', controls: Object.keys(findings).map((k) => ({ key: k, label: k })) },
    ];

  return (
    <div className="flex flex-col gap-8">
      {groups.map((p) => (
        <div key={p.key}>
          <p className="text-[16px] mb-2" style={{ color: 'var(--fg)', fontWeight: 500 }}>{p.label}</p>
          <FindingsCategoryBody
            group={p}
            findings={findings}
            summaries={summaries}
            ratingMeta={ratingMeta}
            showControlIds={showControlIds}
            showSummaries={showSummaries}
          />
        </div>
      ))}
    </div>
  );
}

/**
 * Belt-and-braces smooth scroll for the "Contents" ToC (tabs mode only —
 * every target is already mounted, since it's the ACTIVE category's own
 * rows): the html/body scroll-behavior:smooth CSS covers the plain-anchor
 * fallback, this covers browsers/timings where that alone doesn't fire, and
 * updates the hash without adding a history entry. A plain function, not a
 * hook — safe here (this file has no 'use client') because it only ever
 * RUNS from a browser click event, never during any render pass.
 */
function scrollToControl(key: string, event: MouseEvent) {
  const el = document.getElementById(`ctl-${key}`);
  if (!el) return; // not mounted (shouldn't happen for this ToC) — fall back to the native #hash jump
  event.preventDefault();
  const reduceMotion = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;
  el.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
  history.replaceState(null, '', `#ctl-${key}`);
}

/**
 * One category's body: optional "what this means for you" summary, then its
 * controls as a `.tscroll > .dtable.compact` table — extracted so the row
 * markup can't drift between the stacked FindingsSection (above) and
 * FindingsTabs (which imports this). Plain presentational component: no
 * hooks, no server-only imports, so it stays safe to call from FindingsTabs'
 * 'use client' tree too.
 */
export function FindingsCategoryBody({
  group,
  findings,
  summaries,
  ratingMeta,
  showControlIds,
  showSummaries,
  showToc = false,
}: {
  group: FindingsGroup;
  findings: Record<string, Finding>;
  summaries: Record<string, string>;
  ratingMeta: Map<string, RubricRating>;
  showControlIds: boolean;
  showSummaries: boolean;
  /** Tabs-only: a compact linked index of this category's controls, between
   *  the summary and the rows. The stacked path never sets this. */
  showToc?: boolean;
}) {
  return (
    <>
      {showSummaries && summaries[group.key] && (
        <p className="mb-3 text-[15px]" style={{ color: 'var(--muted)', lineHeight: 1.7 }}>
          {summaries[group.key]}
        </p>
      )}
      {showToc && (
        <Toc
          title="Contents"
          className="mb-6"
          items={group.controls.map((c, i): TocItem => {
            const f = findings[c.key];
            const meta = f ? ratingMeta.get(f.rating) : undefined;
            return { n: i + 1, href: `#ctl-${c.key}`, text: c.label, tone: TONE_COLOR[meta?.tone ?? 'neutral'] };
          })}
          onItemClick={(item, e) => scrollToControl(item.href.replace('#ctl-', ''), e)}
        />
      )}
      <div className="tscroll">
        <table className="dtable compact">
          <thead>
            <tr>
              {showControlIds && <th style={{ width: 64 }}>ID</th>}
              <th>Control</th>
              <th style={{ width: 160 }}>Rating</th>
            </tr>
          </thead>
          <tbody>
            {group.controls.map((c) => {
              const f = findings[c.key];
              const meta = f ? ratingMeta.get(f.rating) : undefined;
              const tone = TONE_COLOR[meta?.tone ?? 'neutral'];
              return (
                <tr key={c.key} id={`ctl-${c.key}`} style={{ scrollMarginTop: 24 }}>
                  {showControlIds && <td className="m">{c.key}</td>}
                  <td>
                    <span style={{ color: 'var(--fg)', fontWeight: 500 }}>{c.label}</span>
                    {f?.rationale && (
                      <p className="mt-1.5" style={{ color: 'var(--muted)', lineHeight: 1.6 }}>{f.rationale}</p>
                    )}
                    {(f?.quotes?.length ?? 0) > 0 && (
                      <details className="mt-1.5">
                        <summary className="mono cursor-pointer" style={{ fontSize: 11.5, color: 'var(--muted)', letterSpacing: '0.06em' }}>
                          Evidence ({f!.quotes.length})
                        </summary>
                        <ul className="mt-2 flex flex-col gap-2">
                          {f!.quotes.map((q, i) => (
                            <li key={i} style={{ borderLeft: '2px solid var(--line)', paddingLeft: 10, color: 'var(--muted)', lineHeight: 1.6 }}>
                              &ldquo;{q.quote}&rdquo;
                              <span className="mono"> · {q.document}</span>
                            </li>
                          ))}
                        </ul>
                      </details>
                    )}
                  </td>
                  <td>
                    <span className="mono flex items-center gap-1.5" style={{ letterSpacing: '0.06em', textTransform: 'uppercase', color: tone, whiteSpace: 'nowrap' }}>
                      <span aria-hidden style={{ width: 7, height: 7, borderRadius: '50%', background: tone, display: 'inline-block' }} />
                      {meta?.label ?? f?.rating ?? 'Not assessed'}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}

function CoherenceSection({ coherence }: { coherence?: CoherenceOutput }) {
  if (!coherence) return <p style={{ color: 'var(--muted)' }}>–</p>;
  return (
    <div className="flex flex-col gap-4 text-[15px]" style={{ color: 'var(--muted)', lineHeight: 1.7 }}>
      <p>{coherence.summary}</p>
      {coherence.contradictions.length > 0 && (
        <ul className="flex flex-col gap-2">
          {coherence.contradictions.map((c, i) => (
            <li key={i} style={{ borderLeft: '2px solid var(--warn)', paddingLeft: 10 }}>
              {c.description}
              <span className="mono" style={{ fontSize: 14, color: 'var(--muted)' }}> · {c.documents.join(', ')}</span>
            </li>
          ))}
        </ul>
      )}
      <p>{coherence.paper_vs_practice}</p>
    </div>
  );
}
