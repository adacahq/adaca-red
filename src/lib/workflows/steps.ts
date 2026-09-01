import type Anthropic from '@anthropic-ai/sdk';
import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  Database,
  FormConfig,
  Json,
  NodeRow,
  ReportSection,
  RubricConfig,
  WorkflowConfig,
  WorkflowStep,
} from '@/lib/supabase/types';
import { type DocumentRow, downloadDocument, extractDocxText, extractPptxText, extractXlsxText } from '@/lib/documents/server';
import { documentsPayloadBytes, MAX_REQUEST_BYTES, proseCall, structuredCall, type LlmDoc } from '@/lib/llm/anthropic';
import { emailConfigured, reportEmailHtml, sendEmail } from '@/lib/email';
import { renderTokens } from '@/lib/forms/tokens';
import { assessFindings, assessSummaries } from './assessOutput';
import { coherenceSchema, principleFindingsSchema } from './schema';
import { computeVerdict } from './verdict';
import type {
  AssessOutput,
  CoherenceOutput,
  Finding,
  NotifyOutput,
  PrincipleAssessOutput,
  ReportOutput,
  ReportRunOutput,
  ReportSectionOutput,
  RunState,
  VerdictOutput,
} from './types';

/**
 * The workflow step library (docs/workflow-forms-plan.md §7.2). Each step
 * executes in UNITS — one bounded piece of work per runner invocation. Units
 * WITHIN a step now run concurrently (parallel units), so a unit no longer
 * mutates `ctx.run.steps` directly: it returns the exact jsonb SLOT it owns
 * (a path under the submission's `data`) plus its output and whether the
 * runner should MERGE it into whatever's already there or REPLACE wholesale.
 * The runner writes that slot atomically via `complete_run_unit` — see the
 * 20260718090000 migration. Units are still idempotent: re-running one only
 * ever touches its own slot, which is what makes crash-resume and admin
 * re-run safe.
 */

export interface StepCtx {
  db: SupabaseClient<Database>;
  anthropic: () => Anthropic;
  model: string;
  submission: NodeRow;
  /** Submission `data` (read-only working copy — the runner no longer persists it wholesale). */
  data: Record<string, unknown>;
  run: RunState;
  workflow: WorkflowConfig;
  form: FormConfig | null;
  formLabel: string;
  documents: DocumentRow[];
  loadRubric(key: string): Promise<RubricConfig>;
  /** Documents as LLM inputs (PDF bytes / extracted text), lazily downloaded. */
  llmDocs(): Promise<LlmDoc[]>;
  /** Public origin for report links, e.g. https://red.example. */
  origin: string;
}

export interface UnitResult {
  /** Path from the submission node's `data` root to this unit's slot, e.g. ['run','steps','assess','findings']. */
  slot: string[];
  output: Json;
  /** true → shallow-merge `output` into whatever's already at `slot` (disjoint keys per unit); false → replace wholesale. */
  merge: boolean;
}

const SYSTEM_PROMPT =
  'You are an AI-governance assessor. You judge organisations strictly on the EVIDENCE in the ' +
  'documents provided: never on assumptions, industry norms, or benefit of the doubt. You are ' +
  'precise, plain-spoken, and constructive. When you quote evidence you quote the exact wording.\n\n' +
  'House style for everything you write. The reader is a busy executive:\n' +
  '- Speak as "we" (the assessing team) and address the reader as "you" / "your organisation".\n' +
  '- Australian English spelling (organisation, prioritise, recognise).\n' +
  '- Never use an em dash. Use a comma, colon, full stop, or a list instead.\n' +
  '- Lead every paragraph with its point, then support it. No teaser sentences, no throat-clearing, ' +
  'and no instructing the reader how to feel about a finding.\n' +
  '- Authority comes from specifics: name the document, the missing artefact, the affected control. ' +
  'Prefer a concrete noun to an adjective, and cut any word that adds no information.\n' +
  '- Use a list when enumerating gaps, reasons, or steps.\n' +
  '- Banned words and constructions: leverage, robust, seamless, cutting-edge, unlock, game-changer, ' +
  'delve, journey, "in today\'s fast-paced world", and the "not X, but Y" antithesis pattern.\n' +
  '- No filler emphasis (honestly, truly, genuinely) and no hype. State findings and their ' +
  'consequences flatly; the evidence carries the weight.';

const DEFAULT_ASSESS_PROMPT =
  'Assess the documents against each control listed below. For every control return a finding: ' +
  'the control key, a rating, a one-to-three-sentence rationale, and the exact quotes you relied ' +
  'on (with the document name each quote came from). Rules: rate only on what the documents ' +
  'actually show; if the documents are silent on a control, rate it not_covered with an empty ' +
  'quotes list; use not_applicable only when the control genuinely cannot apply to this ' +
  'organisation, and say why.';

const DEFAULT_COHERENCE_PROMPT =
  'Review the documents as a set. Identify (1) places where documents contradict each other, ' +
  'naming the documents and describing each contradiction; (2) whether the governance described ' +
  'could actually operate in practice or only looks right on paper, considering ownership, ' +
  'approval routes, monitoring, and incident response; (3) a short overall summary of coherence.';

export async function runUnit(ctx: StepCtx, step: WorkflowStep, sub: number): Promise<UnitResult> {
  switch (step.type) {
    case 'extract':
      return runExtract(ctx);
    case 'assess':
      return runAssess(ctx, step.config, sub);
    case 'coherence':
      return runCoherence(ctx, step.config?.prompt);
    case 'verdict':
      return runVerdict(ctx, step.config.thresholds);
    case 'report':
      return runReport(ctx, step.config.sections, sub);
    case 'notify':
      return runNotify(ctx, step.config);
    default:
      throw new Error(`Unknown workflow step: ${(step as { type: string }).type}`);
  }
}

// ── extract: OOXML (DOCX/PPTX/XLSX) → text (PDFs pass through untouched, sent
// natively to the LLM); single unit. Dispatch on mime_type ONLY: intake set it
// from the sniffed container magic bytes + the zip's marker entry (submit.ts),
// so it is authoritative. The filename is attacker-controlled — an extension
// fallback would route a genuine PDF named ".docx" into mammoth, whose throw
// would terminally fail the run.
function extractorFor(doc: DocumentRow): ((bytes: Uint8Array) => Promise<string>) | null {
  if (doc.mime_type.includes('wordprocessingml')) return extractDocxText;
  if (doc.mime_type.includes('presentationml')) return extractPptxText;
  if (doc.mime_type.includes('spreadsheetml')) return extractXlsxText;
  return null;
}

async function runExtract(ctx: StepCtx): Promise<UnitResult> {
  for (const doc of ctx.documents) {
    const extractor = extractorFor(doc);
    if (!extractor || doc.text_content) continue;
    const bytes = await downloadDocument(ctx.db, doc);
    const text = await extractor(bytes);
    const { error } = await ctx.db.from('documents').update({ text_content: text }).eq('id', doc.id);
    if (error) throw error;
    doc.text_content = text;
  }
  return { slot: ['run', 'steps', 'extract'], output: { extracted: true }, merge: false };
}

// ── assess: one principle per unit, schema derived from the rubric ──
async function runAssess(
  ctx: StepCtx,
  config: { rubric: string; prompt?: string },
  sub: number,
): Promise<UnitResult> {
  const rubric = await ctx.loadRubric(config.rubric);
  const principle = rubric.principles[sub];
  // Out-of-range sub is unreachable in normal operation (the runner bounds
  // candidates to [0, rubric.principles.length)); an empty merge is a safe
  // no-op rather than a thrown error.
  if (!principle) return { slot: ['run', 'steps', 'assess', 'byPrinciple'], output: {}, merge: true };

  const docs = await ctx.llmDocs();
  if (docs.length === 0) throw new Error('No readable documents to assess.');
  if (documentsPayloadBytes(docs) > MAX_REQUEST_BYTES) {
    throw new Error('The uploaded documents are too large to assess together.');
  }

  const controls = principle.controls
    .map(
      (c) =>
        `- ${c.key} · ${c.label}: ${c.description}${c.evidence ? ` (Good evidence: ${c.evidence})` : ''}`,
    )
    .join('\n');
  const ratings = rubric.ratings.map((r) => `- ${r.key}: ${r.label}`).join('\n');
  const prompt =
    `${config.prompt ?? DEFAULT_ASSESS_PROMPT}\n\n` +
    `Principle: ${principle.label}${principle.description ? `. ${principle.description}` : ''}\n\n` +
    `Controls:\n${controls}\n\nRatings:\n${ratings}`;

  const result = await structuredCall<{ findings: Finding[]; summary: string }>({
    client: ctx.anthropic(),
    model: ctx.model,
    system: SYSTEM_PROMPT,
    docs,
    prompt,
    schema: principleFindingsSchema(rubric, principle),
  });

  const findings: Record<string, Finding> = {};
  for (const f of result.findings) findings[f.control] = f;
  const principleOutput: PrincipleAssessOutput = { findings, summary: result.summary };

  // Slot at the BYPRINCIPLE map (one level below 'assess'), keyed by the
  // principle's OWN key: each concurrent unit owns exactly its own key, so
  // the || merge in complete_run_unit combines concurrent principles without
  // clobbering — same owned-key pattern as ReportRunOutput (see types.ts).
  // This is the whole reason assess can now run in parallel.
  return {
    slot: ['run', 'steps', 'assess', 'byPrinciple'],
    output: { [principle.key]: principleOutput } as unknown as Json,
    merge: true,
  };
}

// ── coherence: cross-document contradictions + paper-vs-practice; single unit ──
async function runCoherence(ctx: StepCtx, prompt?: string): Promise<UnitResult> {
  const docs = await ctx.llmDocs();
  // assess is a PRIOR step (barrier already closed), so ctx.run — the
  // snapshot loaded fresh at the top of this call — has its full findings.
  const assess = ctx.run.steps.assess as AssessOutput | undefined;
  const findingsSummary = assess
    ? Object.values(assessFindings(assess))
        .map((f) => `- ${f.control} [${f.rating}]: ${f.rationale}`)
        .join('\n')
    : '(no findings yet)';

  const result = await structuredCall<CoherenceOutput>({
    client: ctx.anthropic(),
    model: ctx.model,
    system: SYSTEM_PROMPT,
    docs,
    prompt: `${prompt ?? DEFAULT_COHERENCE_PROMPT}\n\nControl findings so far:\n${findingsSummary}`,
    schema: coherenceSchema(),
  });
  return { slot: ['run', 'steps', 'coherence'], output: result as unknown as Json, merge: false };
}

// ── verdict: pure code — weighted coverage vs thresholds; single unit ────
async function runVerdict(
  ctx: StepCtx,
  thresholds: { green: number; amber: number },
): Promise<UnitResult> {
  const assessStep = ctx.workflow.steps.find((s) => s.type === 'assess');
  if (!assessStep || assessStep.type !== 'assess') throw new Error('verdict requires an assess step');
  const rubric = await ctx.loadRubric(assessStep.config.rubric);
  const assess = (ctx.run.steps.assess as AssessOutput | undefined) ?? { findings: {} };
  const verdict = computeVerdict(
    rubric,
    assess,
    thresholds,
    ctx.documents.map((d) => d.filename),
  );
  return { slot: ['run', 'steps', 'verdict'], output: verdict as unknown as Json, merge: false };
}

/**
 * Presentation flags, copied from the section's live config onto the STORED
 * ReportSectionOutput at build time (never read live — see ReportSectionOutput's
 * doc comment in types.ts). Omits a key the config left unset rather than
 * writing an explicit `undefined`, so old-shaped configs produce byte-identical
 * output to before this feature existed.
 */
function reportDisplayFlags(
  section: ReportSection,
): Pick<ReportSectionOutput, 'display' | 'showControlIds' | 'showSummaries' | 'collapsed'> {
  const flags: Pick<ReportSectionOutput, 'display' | 'showControlIds' | 'showSummaries' | 'collapsed'> = {};
  if (section.display !== undefined) flags.display = section.display;
  if (section.showControlIds !== undefined) flags.showControlIds = section.showControlIds;
  if (section.showSummaries !== undefined) flags.showSummaries = section.showSummaries;
  if (section.collapsed !== undefined) flags.collapsed = section.collapsed;
  return flags;
}

// ── report: one section per unit; llm sections get a prose call ──
async function runReport(ctx: StepCtx, sections: ReportSection[], sub: number): Promise<UnitResult> {
  const section = sections[sub];
  // Out-of-range sub: unreachable in normal operation, mirrors assess's guard.
  if (!section) return { slot: ['run', 'steps', 'report'], output: {}, merge: true };

  let built: ReportSectionOutput;

  if (section.source === 'llm') {
    const verdict = ctx.run.steps.verdict as VerdictOutput | undefined;
    const assess = ctx.run.steps.assess as AssessOutput | undefined;
    const coherence = ctx.run.steps.coherence as CoherenceOutput | undefined;
    const context =
      `Verdict: ${verdict?.verdict ?? 'unknown'} (coverage ${(100 * (verdict?.coverage ?? 0)).toFixed(0)}%). ` +
      `${verdict?.docsLine ?? ''}\n\nFindings:\n` +
      (assess
        ? Object.values(assessFindings(assess))
            .map((f) => `- ${f.control} [${f.rating}]: ${f.rationale}`)
            .join('\n')
        : '(none)') +
      (coherence
        ? `\n\nCoherence check: ${coherence.summary}\nPaper vs practice: ${coherence.paper_vs_practice}` +
          (coherence.contradictions.length
            ? `\nContradictions:\n${coherence.contradictions.map((c) => `- ${c.description} (${c.documents.join(', ')})`).join('\n')}`
            : '')
        : '');
    const limit = section.maxItems ? ` Limit yourself to at most ${section.maxItems} items.` : '';
    const markdown = await proseCall({
      client: ctx.anthropic(),
      model: ctx.model,
      system: SYSTEM_PROMPT,
      prompt:
        `${section.prompt ?? `Write the "${section.title}" section of the assessment report in plain language.`}` +
        `${limit}\n\nWrite in markdown, no top-level heading (the page supplies it). Assessment context:\n\n${context}`,
    });
    built = { key: section.key, title: section.title, kind: 'prose', markdown, ...reportDisplayFlags(section) };
  } else if (section.source === 'verdict' || section.source === 'findings' || section.source === 'coherence') {
    built = { key: section.key, title: section.title, kind: section.source, ...reportDisplayFlags(section) };
  } else {
    throw new Error(`Unknown report section source: ${section.source}`);
  }

  // Slot at the report MAP itself: each section unit owns exactly its own
  // key, so the || merge in complete_run_unit is non-clobbering across
  // concurrent sections. ReportOutput's ordered array is assembled from this
  // map only in runNotify (see types.ts's ReportRunOutput doc).
  return { slot: ['run', 'steps', 'report'], output: { [section.key]: built } as unknown as Json, merge: true };
}

type NotifyConfig = { emailField?: string; subject: string; ctas: { label: string; href: string }[] };

/**
 * Send the report email, if a recipient and delivery are both configured.
 * Shared by the create path and the adoption-retry path so the subject/html
 * construction can't drift between the two callers. Returns the recipient on
 * a real send, null when nothing is owed (no recipient, or email not
 * configured).
 */
async function sendReportEmail(
  ctx: StepCtx,
  config: NotifyConfig,
  input: { verdict: 'green' | 'amber' | 'red'; docsLine: string; organisation: string; reportToken: string },
): Promise<string | null> {
  const to = config.emailField ? str(ctx.data[config.emailField]) : '';
  if (!to || !emailConfigured()) return null;
  const verdictLabel = input.verdict.charAt(0).toUpperCase() + input.verdict.slice(1);
  const subject = renderTokens(config.subject, {
    verdict_label: verdictLabel,
    form_label: ctx.formLabel,
    organisation: input.organisation,
  });
  await sendEmail({
    to,
    subject,
    html: reportEmailHtml({
      title: ctx.formLabel,
      verdict: input.verdict,
      verdictLabel,
      summary: input.docsLine,
      reportUrl: `${ctx.origin}/d/r/${input.reportToken}`,
      ctas: config.ctas,
    }),
  });
  return to;
}

// ── notify: create the assessment node, email the report; single unit ────
// The DURABLE output is created here, at the end, so a failed run never
// leaves a half-assessment. Everything the report page needs is denormalised
// onto the assessment node — it must render standalone after the submission
// (and its documents) purge.
async function runNotify(ctx: StepCtx, config: NotifyConfig): Promise<UnitResult> {
  // Idempotency guard: makes notify safe under claim-expiry re-execution or a
  // crash-after-create retry — an assessment must never be issued twice for
  // one submission. If one already exists, adopt it and finish without
  // creating another node, but still make sure the email got sent (see
  // below) — adoption must not silently swallow a delivery that never went
  // out.
  const { data: existing } = await ctx.db
    .from('nodes')
    .select('id, data')
    .eq('type_key', ctx.workflow.resultType)
    .eq('data->>submission_id', ctx.submission.id)
    .is('deleted_at', null)
    .limit(1)
    .maybeSingle();
  if (existing) {
    const existingData = (existing.data ?? {}) as Record<string, unknown> & {
      report_token?: string;
      email_sent?: boolean;
      verdict_detail?: VerdictOutput;
    };
    const output: NotifyOutput = {
      assessmentId: existing.id,
      reportToken: existingData.report_token ?? '',
    };

    // Delivery wasn't recorded on a prior attempt (crash between save_node
    // and sendEmail, or between sendEmail and the flag write below). Derive
    // verdict/docsLine from the EXISTING assessment's own data — ctx.run.steps
    // may be empty on a crash-retry that skipped straight to notify's
    // idempotency check. A narrow window remains where sendEmail succeeds but
    // the flag write below fails or crashes, which could double-send on the
    // next retry; that is an accepted trade — double delivery beats the
    // silent non-delivery this replaces.
    if (existingData.email_sent !== true) {
      const to = await sendReportEmail(ctx, config, {
        verdict: existingData.verdict_detail?.verdict ?? 'red',
        docsLine: existingData.verdict_detail?.docsLine ?? '',
        organisation: str(ctx.data.organisation),
        reportToken: output.reportToken,
      });
      if (to) {
        output.emailedTo = to;
        const { error: updateError } = await ctx.db.rpc('save_node', {
          p_id: existing.id,
          p_type: ctx.workflow.resultType,
          p_parent: null,
          p_data: { ...existingData, email_sent: true } as never,
          p_position: null as unknown as number,
          p_change_note: 'Report email delivered',
        });
        if (updateError) throw updateError;
      }
    }

    // data.status 'assessed' is no longer set here — the final
    // advance_run_step (fired once this single-sub unit completes) sets it
    // atomically alongside run.status 'done', so a concurrent complete_run_unit
    // persist elsewhere can't race a second whole-node write.
    return { slot: ['run', 'steps', 'notify'], output: output as unknown as Json, merge: false };
  }

  const verdict = (ctx.run.steps.verdict as VerdictOutput | undefined) ?? {
    verdict: 'red' as const,
    coverage: 0,
    counts: { covered: 0, partial: 0, notCovered: 0, notApplicable: 0, total: 0 },
    docsLine: '',
  };
  // Assemble the ORDERED report from the in-flight MAP, in the workflow's
  // configured section order (parallel report units only agree on keys, not
  // order). Missing keys (shouldn't happen once the report step barrier has
  // closed) are skipped rather than crashing the run.
  const reportMap = (ctx.run.steps.report as ReportRunOutput | undefined) ?? {};
  const reportStep = ctx.workflow.steps.find((s) => s.type === 'report');
  const report: ReportOutput = {
    sections:
      reportStep?.type === 'report'
        ? reportStep.config.sections
            .map((s) => reportMap[s.key])
            .filter((s): s is ReportSectionOutput => s !== undefined)
        : [],
  };
  const assess = ctx.run.steps.assess as AssessOutput | undefined;
  const findings = assessFindings(assess);
  const summaries = assessSummaries(assess);
  const coherence = ctx.run.steps.coherence as CoherenceOutput | undefined;

  const reportToken = randomToken(32);
  const organisation = str(ctx.data.organisation);
  const documentNames = ctx.documents.map((d) => d.filename);

  // Snapshot the rubric's structure (not its full text) so the report can
  // group findings by principle FOREVER — even after the standard is edited
  // or the submission purges. Part of making the assessment self-contained.
  const assessStep = ctx.workflow.steps.find((s) => s.type === 'assess');
  const rubric = assessStep?.type === 'assess' ? await ctx.loadRubric(assessStep.config.rubric) : null;
  const rubricSnapshot = rubric
    ? {
        ratings: rubric.ratings,
        principles: rubric.principles.map((p) => ({
          key: p.key,
          label: p.label,
          controls: p.controls.map((c) => ({ key: c.key, label: c.label })),
        })),
      }
    : null;

  const carried: Record<string, unknown> = {};
  for (const key of ctx.form?.carryOver ?? []) {
    if (ctx.data[key] !== undefined) carried[key] = ctx.data[key];
  }

  const assessmentData: Record<string, unknown> = {
    ...carried,
    title: `${organisation || str(ctx.data.contact_name) || 'Assessment'} · ${ctx.formLabel}`,
    status: 'issued',
    verdict: verdict.verdict,
    form_key: str(ctx.data.form_key),
    submission_id: ctx.submission.id,
    submitted_at: ctx.submission.created_at.slice(0, 10),
    document_names: documentNames.join(', '),
    report_token: reportToken,
    findings,
    summaries,
    coherence: coherence ?? null,
    verdict_detail: verdict,
    report,
    ctas: config.ctas,
    form_label: ctx.formLabel,
    rubric_snapshot: rubricSnapshot,
    // Delivery hasn't happened yet — flipped to true below on a real send.
    // Left false (never backfilled to true) when no email is owed, e.g. no
    // emailField recipient or email not configured; that's a correct terminal
    // state, not a stuck one, since the adoption path only re-attempts a send
    // when a recipient genuinely exists.
    email_sent: false,
  };

  const { data: assessmentId, error } = await ctx.db.rpc('save_node', {
    p_id: null,
    p_type: ctx.workflow.resultType,
    p_parent: null,
    p_data: assessmentData as never,
    p_position: 0,
    p_change_note: `Issued by workflow (submission ${ctx.submission.id})`,
  });
  if (error) throw error;

  const output: NotifyOutput = { assessmentId: assessmentId as unknown as string, reportToken };

  const to = await sendReportEmail(ctx, config, {
    verdict: verdict.verdict,
    docsLine: verdict.docsLine,
    organisation,
    reportToken,
  });
  if (to) {
    output.emailedTo = to;
    // Record delivery on the assessment we just created, reusing the same
    // in-memory assessmentData (no re-read needed) with only email_sent
    // flipped. If this crashes or fails after sendEmail succeeded, the next
    // retry adopts this node above and finds email_sent still false — it
    // will re-send (accepted trade, see the adoption path's comment) rather
    // than silently treat the report as delivered.
    assessmentData.email_sent = true;
    const { error: updateError } = await ctx.db.rpc('save_node', {
      p_id: assessmentId,
      p_type: ctx.workflow.resultType,
      p_parent: null,
      p_data: assessmentData as never,
      p_position: null as unknown as number,
      p_change_note: 'Report email delivered',
    });
    if (updateError) throw updateError;
  }

  // data.status 'assessed' now comes from advance_run_step, not here — see
  // the adoption branch above for why.
  return { slot: ['run', 'steps', 'notify'], output: output as unknown as Json, merge: false };
}

function str(v: unknown): string {
  return typeof v === 'string' ? v : '';
}

/** 32 chars over [0-9a-z] ≈ 165 bits — the report page's only capability. */
export function randomToken(length = 32): string {
  const alphabet = '0123456789abcdefghijklmnopqrstuvwxyz';
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  let out = '';
  for (const b of bytes) out += alphabet[b % alphabet.length];
  return out;
}
