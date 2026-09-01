# Public forms + workflow engine — implementation plan

> Status: approved direction (decisions confirmed 2026-07-04). A generic,
> config-driven **public intake + assessment platform** built inside RED:
> admin-built **forms** that create nodes in a register, a typed-step
> **workflow engine** that LLM-assesses submissions against editable
> **rubrics**, and standalone public **reports**. The first configured
> instance is the StratAlliance **AI Deployer Baseline Diagnostic**
> (see `stratalliance` decisions + the MoSCoW deck); nothing in the build is
> specific to that customer.

## Confirmed decisions

1. **Hosting:** same app, new `(public)` route group (e.g. `/d/[form]`). That
   prefix is exempted from BOTH gates — the worker Basic Auth wall
   (`worker/index.ts`) and the login redirect
   (`src/lib/supabase/middleware.ts`). Turnstile + rate limiting protect the
   public routes only; the rest of the app stays walled + noindexed.
2. **Forms create register nodes.** An admin builds a form targeting a node
   type; each submission creates a node of that type (service-role write
   through `save_node`). Mandatory register fields either appear on the form
   or get preset values with token support (`{{submission_number}}`,
   `{{submission_date}}`, …).
3. **Two node types, two clocks.** `submission` (form values; uploaded docs
   attach via a new `documents` table) and `assessment` (findings, verdict,
   report — created by the workflow). Linked by a plain `submission_id` field
   + denormalised context (form key, dates, document NAMES) so the assessment
   renders standalone after the submission purges. NOT containment, NOT an
   edge — both would dangle after purge.
4. **Retention = whole-node deletion policies.** A node deletes as an atom:
   row + ALL its revisions + attached documents/storage. No field-level or
   revision-level purging anywhere. Anything needing longer retention is
   written onto a longer-lived node by the workflow (evidence quotes,
   contact/lead fields → assessment). Purge is a HARD delete — a deliberate,
   documented exception to the soft-delete convention.
5. **Workflow tool v1 = typed-step linear pipeline.** A `workflow` definition
   is an ordered list of steps drawn from a small code step-library; each
   step's behaviour (rubric, prompts, model, thresholds, report sections,
   recipients) is config. DAG/branching/human-approval steps are phase 2 on
   the same schema.
6. **LLM = Anthropic Claude.** PDFs go to the API natively as document blocks
   (no lossy pre-extraction); DOCX is converted to text first. Model + prompts
   are per-workflow config; key in Workers secrets.

## 1. Principles

- **Everything is definition rows.** Three new `definitions` kinds — `form`,
  `rubric`, `workflow` — join `node`/`edge`. A new assessment product (or the
  Could-have "use-case intake") = new rows, zero new UI code. All three are
  edited in **Admin → Definitions** alongside node/edge types.
- **The register is the destination.** Submissions and assessments are
  ordinary nodes: they get registers, filters, dashboards, revisions, and the
  detail-tab machinery for free. The ops team works leads where they already
  work everything else.
- **Retention is structural, not surgical.** The purge finds nodes of governed
  types whose clock expired and removes node + revisions + documents
  atomically. It never inspects or edits `data`. What survives is decided at
  *write time* by which node the workflow wrote it to.
- **Public surface is minimal and hostile-input-hardened.** Anonymous users
  touch exactly three things: a form page, a status page, a report page. All
  server code; `anon` keeps zero table grants; every write goes through
  service-role server actions with Zod validation + Turnstile + rate limits.
- **Reuse the engine.** `EntityForm`/`FieldInput`/`definitionToZod` render and
  validate the public form from the target type's `config.fields`;
  `save_node` writes it; `RichTextView`, report components, and the design
  system render the report. New chrome only where no equivalent exists.

## 2. Architecture

| Concern | Where | Notes |
|---|---|---|
| **Form defs** (target type, exposed fields, presets/tokens, uploads, copy, workflow) | `definitions` rows, `kind='form'` | admin-editable data |
| **Rubric defs** (principles → controls, evidence guidance) | `definitions` rows, `kind='rubric'` | the customer-editable IP |
| **Workflow defs** (ordered steps + per-step config) | `definitions` rows, `kind='workflow'` | which rubric, prompts, model, thresholds, report template, email |
| **Step library** (what each step *type* does) | code: `src/lib/workflows/steps/*` | small fixed set, like the widget registry |
| **Runner** (executes a workflow against a submission) | code: `src/lib/workflows/runner.ts` | `ctx.waitUntil`, writes run state to the submission node |
| **Documents** (upload, storage, extraction, purge stamp) | `documents` table + Storage bucket | generic node attachments |
| **Settings** (retention defaults, app-wide config) | new `settings` table | singleton key/value, admin-gated |
| **Public surface** (form / status / report pages) | `src/app/(public)/*` | exempt from both gates; Turnstile + rate limits |

Flow:

```
 /d/[form]  ──submit──▶  submission node (+ documents)  ──waitUntil──▶  runner
                                   │                                      │
                             status polling ◀── run state on node         │ steps: extract → assess → coherence
                                                                          │        → verdict → report → notify
                                                                          ▼
                                    assessment node (findings, verdict, report, carried-over contact fields)
                                                │                                │
                                     /d/r/[token] public report        Resend email + CTAs
```

## 3. Database changes

One migration series; all tables follow the strict conventions
(`id/created_at/updated_at` first, nanoid ids, plural names, touch trigger).

### 3.1 `definitions.kind` — three new kinds

```sql
alter table public.definitions drop constraint definitions_kind_check;
alter table public.definitions add constraint definitions_kind_check
  check (kind in ('node','edge','form','rubric','workflow'));
```

Existing RLS already gives admins write + everyone read; nothing else changes.
`config` stays a single jsonb read whole (see §5–§7 for shapes).

### 3.2 `documents` — generic node attachments

```sql
create table public.documents (
  id           text        primary key default public.nanoid(),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  node_id      text        not null references public.nodes(id) on delete cascade,
  filename     text        not null,
  mime_type    text        not null,
  size_bytes   bigint      not null,
  storage_path text        not null,          -- object key in the 'documents' bucket
  text_content text                            -- extracted text (DOCX); null for PDFs
);
```

- Private Storage bucket `documents`; objects keyed
  `{node_id}/{document_id}/{filename}`.
- RLS: `select` for `authenticated` via `has_access()`; **no anon grants, no
  authenticated writes** — inserts/deletes happen only through service-role
  server code. Team views/downloads via short-lived signed URLs.
- `on delete cascade` from `nodes` keeps row cleanup atomic with node purge;
  the *storage objects* are removed by the purge cron (SQL can't delete the
  underlying objects — see §9).

### 3.3 `settings` — app-wide config (first singleton store)

```sql
create table public.settings (
  id         text        primary key default public.nanoid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  key        text        not null unique,
  value      jsonb       not null
);
```

Seed keys:
`retention.submission` / `retention.assessment` — each
`{ "mode": "off" | "days" | "persist", "days": int? }`
(`retention.submission` defaults to `{mode:'days', days:1}`;
`retention.assessment` defaults to `{mode:'persist'}`).
RLS: read `authenticated`, write `is_admin()`. Public pages read settings via
the service-role client (to render the live privacy copy).

### 3.4 `counters` — per-form submission numbers

Token presets need a race-safe sequence (`{{submission_number}}`):

```sql
create table public.counters (
  id         text        primary key default public.nanoid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  key        text        not null unique,     -- e.g. 'form:diagnostic'
  value      bigint      not null default 0
);

create or replace function public.next_counter(p_key text) returns bigint
language sql security definer set search_path = '' as $$
  insert into public.counters as c (key, value) values (p_key, 1)
  on conflict (key) do update set value = c.value + 1
  returning value;
$$;
revoke all on function public.next_counter(text) from public, anon, authenticated;
```

Callable only by service-role (the submission path).

### 3.5 Seed definitions — `submission` + `assessment` node types

Two `kind='node'` rows (fields declared like any other type, so the register,
filters, and dashboards work untouched):

- **`submission`** — `title` (preset from tokens), `status`
  (enum: `received → processing → assessed → failed`, with tones), `form_key`,
  plus whatever submitter-facing fields the form declares (the diagnostic:
  contact name, email, organisation, consent boolean). `allowedParents: []`.
- **`assessment`** — `title`, `status` (enum: `draft → issued`), `verdict`
  (enum: `green/amber/red` with tones `ok/warn/crit`), `submission_id` (text),
  `form_key`, `submitted_at` (date), `document_names` (text), carried-over
  contact fields, `report_token` (text, non-filterable), and the structured
  results in `data`: `findings` (per-control, keyed by rubric control keys),
  `coherence`, `report` (composed section JSON). Findings/report are
  config-schema'd by the rubric — not opaque blobs.

Plus the seed `form`, `rubric` (the 6-principle/~42-control Responsible AI
Standard, entered via admin or seed SQL), and `workflow` rows for the
diagnostic.

### 3.6 Purge RPC

```sql
create or replace function public.purge_nodes(p_ids text[]) returns int
language plpgsql security definer set search_path = '' as $$ ... $$;
```

Deletes, for each id: `revisions` (both `target_kind`s referencing it),
`edges` touching it, `documents` rows (cascade), then the `nodes` row —
hard deletes, in one transaction. EXECUTE revoked from all API roles;
called only by the cron via service-role. This is the **single sanctioned
writer** against append-only revisions; the function comment documents why.

## 4. Public surface & the two gates

- **Routes** (`src/app/(public)/`, no `AppShell`; minimal public layout with
  the canvas look, ThemeToggle, no nav):
  - `/d/[form]` — the form (server component loads the form def + settings;
    client `PublicForm` renders).
  - `/d/[form]/s/[id]` — status page (polls a server action that returns the
    submission's `status`; shows step progress; redirects to the report link
    when `assessed`).
  - `/d/r/[token]` — the standalone report (server component resolves
    `report_token` → assessment node via service role; 404 on miss).
- **Gate A (worker Basic Auth)** — `worker/index.ts` exempts `path === '/robots.txt' || path.startsWith('/d/')`
  *and every asset/RSC request those pages need* (vinext serves assets under
  paths the exemption must cover — verify `_next`-equivalent prefixes during
  build). Keep `X-Robots-Tag: noindex` on everything **except** `/d/*`
  (the wedge should be indexable/shareable — confirm with StratAlliance
  before launch; default to keeping noindex until confirmed).
- **Gate B (login middleware)** — `src/lib/supabase/middleware.ts` adds
  `path.startsWith('/d')` to the public-path check.
- **Service-role client** — new `src/lib/supabase/admin.ts`:
  `createAdminClient()` using `SUPABASE_SERVICE_ROLE_KEY` (server-only secret,
  already stubbed in `.env.example`). Used ONLY by public-surface server code
  and the cron; never imported into client components (enforce with an
  `import 'server-only'` guard).
- **Abuse protection:**
  - **Cloudflare Turnstile** on the form (managed mode). Server action
    verifies the token against `TURNSTILE_SECRET_KEY` before doing anything.
  - **Rate limiting binding** (`wrangler.jsonc` `unsafe.bindings` ratelimit,
    keyed by IP) on the submit action: e.g. 5 submissions/hour/IP; a lighter
    limit on status polls. Fail closed with a friendly message.
  - Upload validation server-side: magic-byte sniff (PDF `%PDF`, DOCX zip),
    per-file ≤ 10 MB, ≤ 8 files, ≥ 1 file, filename sanitised.

## 5. Form definitions (`kind='form'`)

```ts
interface FormConfig {
  targetType: string;               // node type submissions become ('submission')
  workflow?: string;                // workflow def key to run on submit
  fields: string[];                 // keys of target-type fields shown to the submitter
  presets: Record<string, string>;  // field key → literal or token template
  carryOver?: string[];             // field keys the workflow copies onto the result node
  uploads?: {
    enabled: boolean;
    accept: ('pdf' | 'docx')[];
    maxFiles: number;               // diagnostic: 8
    minFiles?: number;              // diagnostic: 1
    guidance?: string;              // markdown: "what to include"
  };
  copy: {                           // all public-page text is config
    title: string; intro?: string;  // markdown
    submitLabel?: string;
    privacyNote?: string;           // ADDITIONAL to the auto-generated retention line
    successNote?: string;
  };
  enabled: boolean;
}
```

- **Tokens** in `presets` (rendered server-side at submit):
  `{{submission_number}}` (via `next_counter('form:'+formKey)`),
  `{{submission_date}}` (ISO date), `{{submission_datetime}}`,
  `{{form_key}}`, `{{form_label}}`. Example diagnostic title preset:
  `"Diagnostic #{{submission_number}} — {{submission_date}}"`.
- **Validation** = `definitionToZod(targetType)` restricted to `fields`, with
  presets merged after — so a submission always satisfies the register's
  required fields (form build-time check in the admin editor warns when a
  required field is neither exposed nor preset).
- **Retention copy is generated**, not hand-written: the form page composes
  the privacy line from the live `retention.*` settings ("Uploaded documents
  are deleted within 24 hours of assessment…"), then appends
  `copy.privacyNote`. The promise can never drift from the setting.
- **Admin editor**: a `FormsEditor` panel in Admin → Definitions (same
  patterns as `ChoicesEditor`): pick target type → tick exposed fields → fill
  presets for the rest (token helper) → uploads → copy → workflow.
- **Rendering**: `PublicForm` reuses `FieldInput` per exposed field +
  a `FileDrop` (new, generic) for uploads. Submit = one server action:
  verify Turnstile → rate limit → validate → upload files to Storage +
  `documents` rows → `save_node` (service role) → kick workflow → redirect to
  status page.

## 6. Rubric definitions (`kind='rubric'`)

```ts
interface RubricConfig {
  principles: {
    key: string;                    // 'FA', 'RS', 'DP', 'IN', 'TR', 'AC'
    label: string;
    description?: string;
    controls: {
      key: string;                  // 'FA-01'
      label: string;
      description: string;         // what the control requires
      evidence?: string;            // what good evidence looks like (guides the LLM + the submitter guidance)
      weight?: number;              // default 1; verdict thresholds use weighted coverage
    }[];
  }[];
  ratings: { key: string; label: string; score: number; tone: string }[];
  // default: covered(2, ok) · partial(1, warn) · not_covered(0, crit) · not_applicable(null, neutral)
}
```

- Edited in Admin → Definitions via a `RubricEditor` (principles/controls with
  drag-reorder, same interaction grammar as `ChoicesEditor`). This is the
  StratAlliance-editable IP — "checked against your standard, editable in the
  app" is literally this screen.
- The rubric also *derives schemas*: the `assess` step builds its structured
  output JSON schema from the control keys, and the assessment node's
  `findings` shape is validated against the same derivation before writing.
  The AU-regulation rule set (Should-have) is a second `rubric` row; the
  workflow's `assess` step config lists which rubric(s) to run.

## 7. Workflow definitions (`kind='workflow'`) + step library

### 7.1 Config shape

```ts
interface WorkflowConfig {
  resultType: string;               // node type the pipeline produces ('assessment')
  model?: string;                   // default 'claude-opus-4-8'
  steps: WorkflowStep[];            // ordered; each { type, config }
}

type WorkflowStep =
  | { type: 'extract' }                                        // DOCX → text; PDFs pass through
  | { type: 'assess';    config: { rubric: string; prompt?: string } }
  | { type: 'coherence'; config: { prompt?: string } }         // cross-doc contradictions, paper-vs-practice
  | { type: 'verdict';   config: { thresholds: { green: number; amber: number } } }
                                                               // weighted coverage ratio → G/A/R + docs-used line
  | { type: 'report';    config: { sections: ReportSection[] } }
  | { type: 'notify';    config: { emailField?: string;       // submission field holding the address
                                   subject: string;           // token-templated
                                   ctas: { label: string; href: string }[] } };

interface ReportSection {
  key: string;                      // 'verdict' | 'gaps' | 'readiness' | 'next_steps' | custom
  title: string;
  source: 'verdict' | 'findings' | 'coherence' | 'llm';
  prompt?: string;                  // for source:'llm' — plain-language composition
  maxItems?: number;                // e.g. ranked next steps
}
```

Prompts in config are **templates** with access to rubric text, document
names, and prior-step outputs; sensible defaults ship in code so an empty
config works. Custom prompts are the tuning surface — editable in admin, no
deploy.

### 7.2 Step library (code — `src/lib/workflows/steps/`)

Each step: `run(ctx) → patch`, where `ctx` carries the submission node,
documents (bytes + extracted text), rubric(s), prior step outputs, and the
Anthropic client; `patch` merges into the run state. Steps are idempotent —
re-running a step overwrites its own output only, which makes admin "re-run
from step N" trivial.

- **`extract`** — DOCX → text via `mammoth` (works under `nodejs_compat`),
  stored on `documents.text_content`. PDFs untouched (sent natively).
- **`assess`** — the core LLM step. One Messages call **per principle**
  (6 calls, sequential): all documents + that principle's controls +
  structured output (`output_config.format` json_schema derived from the
  rubric: per control `{ rating, evidence_quotes: [{document, quote}], rationale }`).
  Document blocks carry `cache_control` so calls 2–6 hit the prompt cache
  (docs are the bulk of the tokens; 5-min TTL comfortably covers a run).
  Evidence-only instruction baked into the default prompt: rate on what the
  documents show, quote exact wording (traceable findings come free).
- **`coherence`** — one call: documents + the findings summary → contradictions
  between documents, and paper-vs-practice gaps ("governance that looks right
  but couldn't operate").
- **`verdict`** — pure code: weighted coverage ratio vs thresholds → G/A/R,
  plus the "documents used / what was missing" line from `documents` +
  `not_applicable`/absent-evidence findings.
- **`report`** — composes `ReportSection[]`: code sections project prior
  outputs; `source:'llm'` sections make one call each for plain-language
  prose (the 4-part report: verdict para, governance gaps, deployment
  readiness, ranked next steps).
- **`notify`** — **creates the assessment node** (service-role `save_node`)
  with findings/verdict/report + denormalised context + `carryOver` fields +
  a fresh 32-char `report_token`, then sends the report email via Resend with
  the report link + CTAs, then stamps the submission `status: 'assessed'`.
  (Node creation lives here, at the end, so a failed run never leaves a
  half-assessment; everything before it accumulates on the submission's run
  state.)

### 7.3 Runner & execution model

> **Built as revised (2026-07-04):** instead of `waitUntil`, the runner
> advances ONE UNIT per invocation (`advanceRun` — a unit is one bounded piece
> of work: one principle's assess call, one report section, …). The public
> status page PUMPS units via `POST /d/s/[id]/advance` while the submitter
> waits; the hourly cron sweeps abandoned runs to completion. No waitUntil
> dependency — identical behaviour in dev (Node) and prod (Workers), and every
> request stays comfortably bounded. The paragraphs below describe the
> original waitUntil sketch and are superseded by this model.

- ~~`runWorkflow(submissionId, workflowKey)` invoked inside `ctx.waitUntil`
  from the submit action (expose `waitUntil` to server actions via the
  worker's execution context — vinext provides it; verify the exact API
  during build and fall back to a fire-and-forget `fetch` to a self route if
  needed).~~
- Run state lives on the submission node's `data.run`:
  `{ status, step, startedAt, finishedAt?, error?, outputs: {...} }` —
  written via `save_node` after each step, so the status page (and the team's
  register) see live progress, and a crashed run is diagnosable + resumable.
- LLM calls are I/O-bound (Workers CPU limits are not the constraint; wall
  clock under `waitUntil` is fine for a multi-minute run). SDK: official
  `@anthropic-ai/sdk` (fetch-based, Workers-compatible), streaming with
  `.finalMessage()` for the long assess calls, adaptive thinking
  (`thinking: {type:'adaptive'}`), default model `claude-opus-4-8`
  (per-workflow override in config).
- **Failure:** any step error → submission `status:'failed'` + `run.error`;
  the status page shows a graceful "we'll be in touch" (with the ops team
  alerted via the register / a dashboard widget). Admin action **Re-run**
  (from the submission's detail page) restarts from the failed step.
  Durable Queues are the phase-2 hardening if retry volume warrants it.
- Payload guard: 8 files × 10 MB can exceed the API's 32 MB request limit
  once base64-inflated — the runner checks total size and, if over, falls
  back per-document (assess each doc, merge) — flagged in the run state.

## 8. Report + email

- **Report page** (`/d/r/[token]`): server component; service-role lookup of
  the assessment by `report_token`; renders the composed `report` sections
  with canvas components (verdict banner uses the `verdict` enum's tone;
  findings tables reuse `Chips`/`FieldValue`; RED design language
  throughout). Ends with the 3 CTAs from workflow config. Standalone by
  construction — everything it needs lives on the assessment node.
- **Email** (`src/lib/email/`, greenfield): thin Resend wrapper
  (`resend` npm package; `RESEND_API_KEY`/`EMAIL_FROM` already stubbed in
  `.env.example`), `sendReportEmail(to, subject, reportUrl, verdict, ctas)`
  with a minimal on-brand HTML template. Also the home for the older
  "access granted" mail whenever that gets built.
- **PDF download is a Should**, not in this build — the shareable link
  covers distribution; the page is print-styled (`@media print`) as a stopgap.

## 9. Retention & purge

- **Two settings** (§3.3), each `off / N days / persist`, defaulting
  submission=1 day, assessment=persist. **Per-form override**:
  `FormConfig.retention?: { submission?: …; assessment?: … }` — the reusable
  template story means different clients make different promises.
- **Clock start:** submission clock runs from `data.run.finishedAt` (an
  unprocessed submission is never purged out from under a slow run; failed
  runs hold until re-run or manual delete). Assessment clock from
  `created_at`.
- **Cron:** `wrangler.jsonc` gains `"triggers": { "crons": ["17 * * * *"] }`
  and `worker/index.ts` a `scheduled` handler that (service-role):
  1. reads settings + form overrides, finds expired governed nodes;
  2. deletes their Storage objects (`storage.from('documents').remove(...)`);
  3. calls `purge_nodes(ids)` — rows + revisions + documents + edges, hard;
  4. logs counts (a `purge` line in the run output; visible in `wrangler tail`).
- The purge never reads `data` beyond the clock fields and never edits jsonb —
  whole nodes only (decision #4).

## 10. Security & RLS summary

- `anon` grants: **none**, unchanged. All public reads/writes go through
  server code holding the service-role key; every public entry point
  validates with Zod + Turnstile + rate limit before touching the DB.
- New tables: `documents` (read `has_access`, no API writes), `settings`
  (read auth'd, write `is_admin`), `counters` (no API access).
- New SECURITY DEFINER fns (`next_counter`, `purge_nodes`): `search_path=''`,
  EXECUTE revoked from api roles; run `supabase db advisors` after.
- Secrets (Workers): `SUPABASE_SERVICE_ROLE_KEY`, `ANTHROPIC_API_KEY`,
  `TURNSTILE_SECRET_KEY`, `RESEND_API_KEY` via `wrangler secret put`;
  `.env.example` documents all four.
- `report_token`: 32-char nanoid-alphabet token (~165 bits), generated
  server-side, stored in assessment `data`; the only public read path for
  assessments. Node `id` is never used as a public capability.
- Uploaded files are hostile input: size/type/magic-byte checks, sanitised
  names, private bucket, and they flow only to the Anthropic API — never
  rendered or re-served to browsers except via authenticated signed URLs.

## 11. Phasing (maps to the 4-week roadmap)

- **Phase 1 — Platform plumbing + walkable journey (deck weeks 1–2,
  "clickable prototype").** Migration (§3), gates opened for `/d/*`,
  service-role client, `(public)` layout, form defs + `PublicForm` + uploads
  + Turnstile + rate limit, submission nodes appearing in a register, status
  page, report page + email rendering a **stubbed** workflow output (canned
  findings), retention settings UI + purge cron. End state: full journey
  upload → assess → report → email, fake brain.
- **Phase 2 — Real brain (weeks 2–4, "demo-ready").** Anthropic client,
  step library (`extract`/`assess`/`coherence`/`verdict`/`report`/`notify`),
  rubric editor + the Responsible AI Standard seeded, structured outputs from
  rubric-derived schemas, prompt tuning against the real StratAlliance sample
  docs, run-state polling, re-run action, payload fallback.
- **Phase 3 — Admin polish + hardening.** FormsEditor + RubricEditor +
  workflow editor in Admin → Definitions (phase 1–2 can seed via SQL),
  assessment register views/dashboard widgets for the lead pipeline,
  `wrangler tail`-able logging, advisors pass, load test the public path.
- **Phase 4 — Should-haves on the same rails.** AU-regulation second rubric,
  PDF report download, shareable-link management, per-form usage caps,
  Queues-based retry if needed. (Use-case intake = new form+workflow rows +
  maybe an `approve` step type — the phase-2 DAG/human-step extension.)

## 12. Files to create / modify

Create:
- `supabase/migrations/…_forms_workflows.sql` — kinds, `documents`,
  `settings`, `counters`, purge RPC, seed `submission`/`assessment` defs
- `supabase/migrations/…_seed_diagnostic.sql` — form/rubric/workflow rows
- `src/lib/supabase/admin.ts` — service-role client (`server-only`)
- `src/lib/forms/` — config types, token rendering, submit action, form loader
- `src/lib/workflows/` — `runner.ts`, `steps/*`, config types, schema-from-rubric
- `src/lib/llm/anthropic.ts` — client factory + call helpers (caching, streaming)
- `src/lib/email/` — Resend wrapper + report template
- `src/lib/documents/` — upload/signing/extraction (`mammoth`) helpers
- `src/lib/settings/` — read/write helpers + retention-copy composer
- `src/app/(public)/layout.tsx`, `d/[form]/page.tsx`,
  `d/[form]/s/[id]/page.tsx`, `d/r/[token]/page.tsx`
- `src/components/public/` — `PublicForm`, `FileDrop`, `RunStatus`,
  `ReportView`, `VerdictBanner`
- `src/components/admin/` — `FormsEditor`, `RubricEditor`, `WorkflowEditor`,
  `RetentionSettings`

Modify:
- `worker/index.ts` — `/d/*` gate exemption + `scheduled` purge handler
- `src/lib/supabase/middleware.ts` — public path allowlist
- `wrangler.jsonc` — cron trigger, rate-limit binding
- `src/lib/supabase/types.ts` — `FormConfig`/`RubricConfig`/`WorkflowConfig`
- `package.json` — `@anthropic-ai/sdk`, `mammoth`, `resend`
- `.env.example`, `CLAUDE.md` (document the new layer once built)

## 13. Risks & mitigations

- **Two gates opened** → the exemption is a single narrow prefix in each
  gate, tested both ways (public path works logged-out; any non-`/d` path
  still 401s). noindex stays on until explicitly lifted.
- **`waitUntil` behaviour under vinext** → verify early in phase 1 with the
  stub workflow (it's the riskiest unknown); fallback is a self-invoked
  worker route. Queues remain the durable upgrade path.
- **LLM cost/latency per run** → per-principle calls + prompt-cached document
  blocks (docs tokenised once at write, ~0.1× on 5 subsequent calls);
  runs are minutes-long by design with a status page, not a blocking request.
- **Prompt quality** → prompts are config (tunable without deploys); phase 2
  budgets explicit tuning time against real sample documents; evidence-quote
  requirement keeps outputs auditable.
- **Request-size ceiling (32 MB)** → runner-level size check + per-document
  fallback (§7.3); upload caps sized so the common case never hits it.
- **Retention promise vs reality** → copy is generated from the live setting
  (§5); purge is whole-node with logged counts; failed runs hold the clock.
- **Hard delete vs append-only revisions** → one sanctioned SECURITY DEFINER
  path (`purge_nodes`), documented in the migration and CLAUDE.md.
- **Abuse of a free LLM endpoint** → Turnstile + per-IP rate limit + per-form
  `enabled` kill-switch + (phase 4) usage caps; costs are bounded by
  submissions/hour.
