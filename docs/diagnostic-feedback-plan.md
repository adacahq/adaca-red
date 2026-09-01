# Diagnostic evaluation feedback — response plan

Source: *AI Deployer Baseline Diagnostic Evaluation 07.20.2026* (StratAlliance
evaluator feedback, received 2026-07-28).
Status: **EXECUTED 2026-07-28 — all rounds built, adversarially verified,
E2E-tested (dev + production) and deployed to https://red.adaca.com.**
Known latent issue deferred by choice: `complete_run_unit` does not vivify
`run.done` and returns 0 (not NULL) when the parent path is missing — currently
unreachable (every caller seeds `done`), but fix it before any refactor of the
run-state seeding. Operational rule discovered in verification: config flips
that INSERT or REORDER report sections / rubric principles while a run is
mid-step silently drop the inserted/reordered work (APPEND is safe) — flip only
with no runs in flight.

## The governing constraint

Minimise (ideally prevent) changes that cannot be DB-driven. Where the feedback
asks for something the code currently hardcodes, we do **not** hardcode the new
behaviour either — we make a one-time code investment that turns the surface
into a **config-driven renderer**, then apply the requested change as config.
Every change and every reversion is then an admin/DB edit. This is the same
pattern the app already uses twice: definitions-driven forms and the dashboard
widget registry (small code registry of renderers + pure-data instances).

Key property: **deploy ≠ change**. Every new config knob defaults to current
behaviour, so shipping the code alters nothing visible until the config flips —
and flipping back restores today's app exactly.

## Decisions taken (2026-07-28)

1. **Page CTA** — add a config-driven CTA (label + href) to the public surface;
   placement/treatment is our design call, not necessarily top-right
   ("they aren't designers").
2. **Score-tile guidance** — fixed per-rating copy: a `guidance` field on each
   rubric rating, edited in Admin → Rubrics. Deterministic, fully DB-controlled.
3. **Control numbering (F.3, F.5…)** — hidden in the main customer-facing
   findings; full numbered traceability kept in a **collapsed appendix** section
   at the bottom of the report.
4. **File types** — build **PPTX + XLSX** extractors now. OOXML only; legacy
   binary `.ppt`/`.xls` out of scope.
5. **Report CTAs** — all three route to `https://www.adaca.com/contact/`
   (Adaca controls lead gen). No intake form build.

## Feedback → mechanism map

| # | Feedback item | Mechanism | Class |
|---|---|---|---|
| 1 | Tighter report narrative ("observed / why it matters / what this means for you") | Prompt edits: assess prompt, per-section `prompt`, `maxItems` (Admin → Workflows) | config-only |
| 2 | CTA destinations | `notify.config.ctas[].href` → adaca.com/contact (Admin → Workflows) | config-only |
| 3 | Report structure order | `report.config.sections` is an ordered array | config-only |
| 4 | Clickable score tiles + next-step | `display: 'inline'\|'tiles'` on the verdict section; `RubricRating.guidance` copy | code-once |
| 5 | Remove F.x numbering / expert appendix | `showControlIds` flag on findings sections; appendix = 2nd findings section, collapsed, IDs on | code-once |
| 6 | Per-category "what this means for you" | Per-principle `summary` in the assess output schema; renderer flag | code-once |
| 7 | Progress stages + timeframe | Stage list rendered from the workflow's own steps; `expectedMinutes` in workflow config | code-once |
| 8 | Delay transparency | Ledger-driven detail ("Assessing principle 4 of 6 across 3 documents"); config flag | code-once |
| 9 | Landing visuals + G/A/R tiles | `copy.blocks` block registry (prose · verdictLegend · steps · stats) on FormConfig | code-once |
| 10 | Action-oriented CTA on page | `copy.cta {label, href}` on FormConfig; placement per design system | code-once |
| 11 | PPT/Excel uploads | New OOXML extractors; enabled per form via existing `uploads.accept` | capability |

## Rounds

### Round 0 — config-only, no deploy (live DB via Admin)

- Rewrite the assess + report-section prompts to the
  observed / why-it-matters / what-this-means format; trim length via prompts +
  `maxItems`. Include a prompt line forbidding control-ID citations in prose.
- Point all three CTA hrefs at `https://www.adaca.com/contact/` (labels kept).
  The repo seed keeps its `stratalliance.example` placeholders — live config is
  the control surface.
- Reorder `report.config.sections` toward the recommended structure
  (snapshot → findings by category → coherence → next steps); tiles and
  per-category summaries join in Round 1.

### Round 1 — report presentation layer

- `ReportSection` (verdict source): `display?: 'inline' | 'tiles'`
  (default `'inline'` = today). Tiles = four clickable cards
  (covered / partial / not covered / N-A) that expand to a guidance line.
- `RubricRating.guidance?: string` + Admin → Rubrics editor field — the tile
  copy, StratAlliance-tunable.
- `ReportSection` (findings source): `showControlIds?: boolean`
  (default `true` = today) and `collapsed?: boolean`. The customer view flips
  IDs off; a second findings section ("Detailed traceability", collapsed,
  IDs on) forms the appendix — pure config composition.
- Assess step: add per-principle `summary` ("what this means for you") to the
  structured-output schema; findings renderer shows it under each principle
  group behind a `showSummaries` flag (default off until config enables it).
  Wording is steered by the assess prompt (DB).

### Round 2 — status page transparency

- Render the full stage list from the workflow's configured steps (labels
  overridable via optional per-step `label` config, code map as fallback),
  highlighting the current stage.
- `WorkflowConfig.expectedMinutes?: [number, number]` → "usually takes N–M
  minutes" copy, replacing the hardcoded line.
- Detail line derived from the run ledger + rubric ("Assessing principle 4 of
  6 across 3 documents"), behind a config flag. Requires exposing per-step
  sub-unit counts in `RunProgress` (read-only plumbing; no engine changes).

### Round 3 — landing blocks + page CTA

- `FormConfig.copy.blocks?: LandingBlock[]` + a block-renderer registry:
  `prose`, `verdictLegend` (three G/A/R tiles whose meaning renders from the
  live verdict thresholds — same pattern as privacy copy rendering from the
  live retention setting), `steps`, `stats`. Empty/absent = today's page.
- `FormConfig.copy.cta?: { label: string; href: string }` rendered on the
  public form and report pages; visual treatment per the design system
  (hairline header bar or in-flow accent button — implementation decides,
  we own the design). Absent = today's state.
- Admin → Forms editor grows a blocks section (add/reorder/remove).

### Round 4 — PPTX/XLSX capability

- `sniffKind` today treats any zip as DOCX — must instead open the OOXML zip
  and inspect `[Content_Types].xml` to distinguish docx/pptx/xlsx.
- Extractors (Workers-compatible, dependency-light): PPTX slide text via zip +
  XML parse; XLSX via sharedStrings + sheet XML (or SheetJS if it stays lean).
  Both go the extract-to-text route (as DOCX does) — only PDFs are sent
  natively to the LLM.
- Type widens to `('pdf'|'docx'|'pptx'|'xlsx')[]`; MIME map + FileDrop accept
  strings extended. **Enabling = adding `'pptx'`/`'xlsx'` to the form's
  `uploads.accept` in DB; reverting = removing them.** Code is dormant
  capability; DB is the switch.

## Acceptance per round

`npm run build` (bundling), scoped `npx tsc --noEmit` (zero errors in touched
files), `npm test`, `npm run lint`, plus a live end-to-end run on a scratch
submission before flipping any config on the real form. Rounds 1–4 each verify
the default-config path renders identically to today before the config flips.
