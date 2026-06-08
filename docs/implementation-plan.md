# Adaca Red — Baseline App Implementation Plan

The full initial scope to take the current scaffold (vinext + canvas design
system + Supabase schema) to a usable operations platform: Microsoft auth, the
definitions-driven CRUD engine, every entity screen, relationships + RED, reports,
and admin.

This plan assumes the model in `CLAUDE.md`: a `definitions`-driven graph of
`nodes` (initiative/group/task/risk/risk_group/incident/incident_update) and
`edges` (mitigates[RED]/realises/remediates/related), with `assignments` and
`revisions`. Setup is in `README.md`.

---

## 0. Style guide — applies to EVERY screen

Non-negotiable: every page and component below is built in the **editorial-canvas
design system** already in the repo. Before building any screen, reach for
`src/components/canvas/*` and the tokens in `src/app/globals.css`.

- **Tokens, not literals.** All colour/size/letter-spacing go inline via
  `var(--token)`; layout via Tailwind. Ink dominates; the accent is used **once**
  per component.
- **Hairlines, not boxes.** 1px `var(--line)` separators; no shadows, no rounded
  corners (globally forced off), no background fills behind body text.
- **Mono uppercase eyebrows** label things (10–11px, wide tracking). Numbers in
  mono. Geist + Geist Mono. No emojis.
- **Reuse first.** `KeyFacts`, `SectionHeader`, `Toc`, `StatBand`,
  `HeadlineMetrics`, `MethodStepper`, `SplitCard`, `CompareTable`,
  `ProfilePanel`, `ZoneAxis`, `Callout`, `Faq`, `Button`, `Eyebrow`. Build new
  components in the same register; charts (recharts) and the rich-text surface
  must be themed to these tokens (see §6, §7).

Acceptance for any screen includes "looks like it belongs to the canvas system."

---

## 1. Architecture approach

- **Rendering:** vinext App Router. **Server Components** read via
  `src/lib/supabase/server.ts`; **Server Actions / Route Handlers** mutate.
  Interactive pieces (forms, filters, charts, trees, editor) are **client
  islands** using `src/lib/supabase/client.ts`. Session refresh runs in
  `src/proxy.ts` (Next.js 16 renamed `middleware.ts` → `proxy.ts` with a `proxy`
  export; `next/headers` verified), using the standard `@supabase/ssr` pattern.
- **Everything generic flows from `definitions`.** Lists, forms, filters and
  validation are generated from `definitions.config.fields` — adding a field or
  type is a seed-migration edit, not new UI code.
- **Access is role-based via RLS.** The system role on `public.users`
  (`admin`/`owner`/`member`/`viewer`, or NULL = blocked) gates everything; the
  RLS helpers (`has_access`/`can_write`/`is_admin`) are already in the schema.
- **Mutations always write history.** Every node/edge create/update goes through
  one path that snapshots into `revisions` and bumps `current_rev` (atomic — via
  a Postgres RPC, see §11).
- **Rich text = Markdown.** richtext fields store **Markdown** in the `data`
  jsonb; editing and display both go through **Lexical** with markdown transformers.
- **Charts = recharts**, themed to the canvas tokens (deterministic colours,
  hairline grids, mono labels — no default recharts styling).
- **Email = Resend.** Under Microsoft SSO, Supabase sends no auth emails; Resend
  is the transactional provider for the app's own email (server-side only).
- **No in-app 2FA.** Multi-factor is inherited from Microsoft Entra SSO; the app
  trusts the IdP and does not implement its own MFA.

---

## 2. Information architecture (routes)

### Auth
| Route | Purpose |
|---|---|
| `/login` | Single "Sign in with Microsoft" action (`signInWithOAuth({ provider: 'azure' })`) |
| `/auth/callback` | OAuth code exchange → session; enforces the email-domain allowlist |
| `/no-access` | Blocker shown when a signed-in user has no system role yet |

No sign-up / forgot / reset routes — Microsoft owns credentials; profiles are
provisioned just-in-time on first login.

### App (authenticated + role-gated, behind middleware + protected layout)
| Route | Purpose |
|---|---|
| `/` | Ops dashboard (rollups, RED trends, attention list) |
| `/initiatives` · `/new` · `/[id]` · `/[id]/edit` | Initiative register, create, detail (with task/group tree + RED→risks), edit |
| `/risks` · `/new` · `/[id]` · `/[id]/edit` | Risk register (grouped), create, detail (mitigations + realising incidents + residual), edit |
| `/incidents` · `/new` · `/[id]` · `/[id]/edit` | Incident register, create, **full incident report**, edit |
| `/reports` + `/reports/{risk-matrix,red-coverage,portfolio,incidents}` | Reports |
| `/graph` | Relationship map (initiative↔risk↔incident) — late baseline |
| `/admin/{users,roles,definitions}` | Admin: assign system roles, manage reference data |
| `/profile` | Account: display name (email/role read-only) |
| `/search?q=` | Global node search |

Tasks/groups are managed inside an initiative's detail tree; risk_group inside
`/risks`; `incident_update` timeline + action-item tasks inside an incident.

---

## 3. Auth & access (Microsoft / Supabase Auth)

- **Provider:** Microsoft (Azure) OAuth via Supabase. `/login` is a single
  button; no email/password, no sign-up, no password-reset flows.
- **Just-in-time accounts:** first login mints the `auth.users` row → the
  `handle_new_user` trigger creates the `public.users` profile. No "create
  account" step.
- **Domain allowlist:** only emails in `VITE_ALLOWED_EMAIL_DOMAINS` (env, e.g.
  `adaca.com`) may sign in. Enforced in `/auth/callback` (friendly rejection +
  sign-out). (Hosted Supabase blocks custom DB GUCs, so there is no DB-level
  check — app-layer only.)
- **Role gating:** new users have **no system role** → redirected to
  `/no-access` ("your role hasn't been assigned yet"). RLS also denies all data
  until a role exists. An **admin/owner** assigns roles in `/admin/users` (calls
  the `set_user_role` RPC). The first admin is bootstrapped by SQL (see README).
- **Session:** `src/proxy.ts` (Next 16's renamed middleware) runs the
  `@supabase/ssr` refresh and redirects unauthenticated users to `/login`; the
  protected app layout additionally checks `getUser()` + the user's role (→
  `/no-access` if null).
- **Sign-out:** Server Action calling `supabase.auth.signOut()`.
- **MFA:** not implemented in-app — multi-factor is enforced by Microsoft Entra
  (Conditional Access) at sign-in. The app trusts the IdP.

Pages to build: `/login`, `/auth/callback` (route handler), `/no-access`, the
protected app layout, `src/proxy.ts`. **(Built in Phase 0 — see §13.)**

Acceptance: a non-`adaca.com` account is rejected; a new allowed user lands on
`/no-access`; after an admin grants a role they reach `/`; refresh keeps session;
sign-out returns to `/login`.

---

## 4. The generated CRUD engine (the core machinery)

One set of definitions-driven primitives powers every entity. Build once, reuse
for initiative/risk/incident/task/group/incident_update.

- **`definitionsToZod(config)`** — `src/lib/definitions/zod.ts`. Maps each
  `FieldDef` to a Zod rule. **Numbers are enforced to their `options.min/max`
  and to integers where 0–4 applies (RED, likelihood, impact)** — decision: RED
  is strict integer 0–4. Single validator for form + server action.
- **`<EntityForm definition data? parent? />`** — one field per `config.fields`
  (ordered by `position`) via per-`data_type` renderers: text, number, enum
  (select), date (picker), boolean (toggle), **richtext (Lexical → Markdown)**,
  user (people picker). Validates with the generated Zod schema; submits to a
  Server Action.
- **`<EntityFilterBar definition />`** — controls from `filterable` fields
  (enum→multiselect, number→range, date→range, text→search) → URL params.
- **`<EntityTable definition rows />`** — canvas register (hairline rows, mono
  numbers), sort, pagination, row → detail.
- **`<FieldValue field value />`** — read-only renderer (status/severity → canvas
  chips, date → formatted, richtext → rendered Markdown).

Acceptance: pointing the engine at a new definition yields working
list+filter+create+edit with no bespoke code.

---

## 5. Entity screens

Each = the engine + a thin type-specific shell, all in the canvas register.

### Initiatives
- **Register:** table + filters (status, priority, targetDate).
- **Detail:** header (title/status/priority), fields, **containment tree** of
  groups/tasks (expand/collapse, add child, reorder via `position`, ∞ depth),
  **assignments**, **RED edges → risks** (R/E/D + assessment), **revisions**.

### Risks
- **Register:** grouped by `risk_group`; filters (status, likelihood, impact,
  category); inline inherent L×I.
- **Detail:** fields, **mitigating initiatives** (incoming `mitigates` w/ RED),
  **realising incidents** (`realises`), residual-vs-inherent (§6), assignments,
  revisions.

### Incidents (full incident report)
The incident node is shaped as an **operational incident report**:
- **Report fields:** title, status (open→investigating→identified→monitoring→
  resolved→closed), severity (sev1–4), occurredAt / detectedAt / resolvedAt, how
  detected, impact, what happened, root cause, resolution (richtext = Markdown).
- **Timeline:** chronological `incident_update` child nodes (time + note).
- **Action items:** child `task` nodes.
- **Links:** realised risks (`realises`), remediating initiatives (`remediates`).
- **Revisions:** full history — reports get updated as facts emerge, so the
  history view matters most here.

Acceptance: full CRUD + tree + timeline + relationship panels + history for all
three, in the canvas style.

---

## 6. Relationships & RED

- **Edge management:** from a node detail, create/link allowed edges
  (`mitigates`, `realises`, `remediates`, `related`) via a node picker
  constrained by the edge definition's `from`/`to`.
- **RED editor** (`mitigates` only): R/E/D as **integer 0–4** banded inputs +
  `assessmentDate`. Saving creates a **revision** → builds the trend.
- **RED visualisations** (canvas-themed recharts):
  - `RedTrend` — **stacked 0–12** composite per edge over assessment dates, and
    **grouped 0–4** per-axis drill-down (the two-view pattern from `red.md`).
  - `RedScore` — compact current R/E/D readout (deterministic colours from tokens).
- **Residual exposure (decision #3, resolved):** "residual" = the risk's
  *inherent* likelihood×impact reduced by how well it's mitigated. The baseline
  **computes it from a transparent formula** rather than letting an analyst type
  a number: `residual = inherent × (1 − coverage)`, where `coverage` is derived
  from the risk's `mitigates` edges (Relevance gates, Extent scales, Duration
  decays over time). The formula is shown in the UI; we never store an
  uncomputed composite (avoids the `red.md` "score stored but not charted" trap).
  An optional analyst override can come later.

Acceptance: create an Initiative–Risk RED edge, re-score it twice, see the trend;
a risk shows residual derived from its edges; colours are deterministic.

---

## 7. Reports & dashboards

All recharts, themed to the canvas (hairline grids, mono ticks, token colours).

| Report | Content |
|---|---|
| **Dashboard** (`/`) | Counts by type/status; open incidents by severity; top risks by residual; initiatives with weak RED coverage; recent activity (revisions). |
| **Risk matrix** | 5×5 likelihood×impact grid; cells link to filtered risks; inherent/residual toggle. |
| **RED coverage** | Risks with **no** `mitigates` edge (unmitigated) + low-aggregate-RED risks; per-initiative reach. |
| **Portfolio** | Initiatives with covered risks + RED quality; status/priority rollup. |
| **Incident analytics** | Severity breakdown, recurrence (repeat `realises` to a risk), MTTD/MTTR from occurred/detected/resolved, trend over time. |

Acceptance: each report reads live data, filters work, links drill into registers.

---

## 8. Admin

- **Users** (`/admin/users`): list `users`, assign/clear the **system role**
  (calls `set_user_role`), see who is blocked. Gated to `is_admin()`.
- **Roles** (`/admin/roles`): manage attribution `roles`.
- **Definitions** (`/admin/definitions`): view all node/edge types + fields;
  baseline = viewer proving the registry; edit (add field/type, reorder) as a
  fast-follow (admin-gated writes already allowed by RLS).

---

## 9. Shared components to build (on the canvas system)

Reuse `src/components/canvas/*` first; build net-new (all canvas-styled):
- `AppShell` / authed sidebar+topnav (extend the `Docs` layout for app nav).
- `Register` (sortable, filterable, paginated table).
- `EntityForm`, `EntityFilterBar`, `FieldValue`, per-`data_type` field renderers.
- `RichText` (Lexical editor + read-only renderer, Markdown in/out).
- `Tree` (containment: expand/reorder/add-child).
- `NodePicker` / `UserPicker`.
- `RedEditor`, `RedTrend`, `RedScore`, `RiskMatrix`.
- `RevisionHistory` (timeline + diff + restore).
- `AssignmentsPanel`, `StatusChip`/`SeverityChip`, toasts, empty/loading/error
  states, confirm dialogs, the `/no-access` blocker.

---

## 10. Cross-cutting concerns

- **Email (Resend):** SSO means Supabase sends no auth email, so app email goes
  through **Resend** via a server-only `src/lib/email` module (`RESEND_API_KEY`,
  `EMAIL_FROM`). Baseline sends are intentionally minimal: an **"access granted"**
  note when an admin assigns a role (the `/no-access` → access moment) and
  ownership/assignment notifications. Sent from Server Actions / RPCs, never the
  client. Bulk digests + Slack are post-baseline.
- **Revisions/audit:** every mutation snapshots to `revisions`; author from
  `auth.uid()` → `users`.
- **Validation:** one Zod schema per definition (client + server); integer 0–4
  enforced where it applies.
- **Search:** Postgres `ilike` on title for baseline; `tsvector` over `data` later.
- **Pagination:** range-based on registers.
- **States & a11y:** loading skeletons, empty states, error boundaries; keyboard
  nav on tree/forms; canvas restraint.
- **Soft delete + restore** everywhere (`deleted_at`).

---

## 11. Data / mutation layer

- **`save_node` / `save_edge` RPCs** (Postgres functions, `SECURITY INVOKER` so
  RLS applies): upsert the row, insert the matching `revisions` snapshot, bump
  `current_rev` — atomically. Server Actions call these.
- **`assign` / `unassign`** helpers on `assignments`.
- **Soft-delete** RPC stamping `deleted_at` + a revision.
- **`set_user_role`** RPC already exists (admin-gated) for `/admin/users`.
- Extend `src/lib/supabase/queries.ts` (filtered/paginated lists, tree fetch,
  edge fetch).

---

## 12. Seeders

- **Baseline definitions + roles ship as a migration**
  (`..._seed_definitions_and_roles.sql`) so they exist in every environment:
  node types (initiative, group, task, risk_group, risk, **incident** [report-
  shaped], **incident_update**) and edge types (mitigates[RED], realises,
  remediates, related), plus roles (owner/assignee/reviewer). Adding/changing a
  field or type = editing this seed, then `supabase db push`.
- **Local demo data** (optional) goes in `supabase/seed.sql` (runs on
  `supabase db reset`) — a sample initiative tree, a couple of risks, one full
  incident report with a timeline, and a RED edge — to develop against. Not
  shipped to production.

---

## 13. Phased delivery

| Phase | Scope | Done when |
|---|---|---|
| **0 · Foundations** ✅ **BUILT** | Microsoft auth (`/login`, `/auth/callback`, `/no-access`), `src/proxy.ts`, protected role-aware layout (`(app)`), app shell/nav, `/admin/users` role assignment, dashboard shell, env wired, `definitionsToZod` | Allowed user signs in → blocked until role → admin grants role → dashboard shell |
| **1 · CRUD engine + Initiatives** ✅ **BUILT** | §4 engine (`EntityForm`/`FilterBar`/`Register`/`FieldInput`/`FieldValue`) incl. Lexical richtext, Initiative register/detail/form, containment `Tree` | Create/edit/list/filter an initiative with nested tasks |
| **2 · Risks + Incidents** ✅ **BUILT** | Engine for risks + the incident report (`IncidentTimeline` + action-item tasks), `AssignmentsPanel`, `RevisionsPanel`, plain-edge `EdgeLinker` | Full CRUD + history for all three node types |
| **3 · Relationships + RED** ✅ **BUILT** | `RedEditor`, `RedScore`, `RedTrend` (recharts), `MitigationManager`, residual on the risk side | RED edge created, re-scored, trended; residual shown |
| **4 · Reports** ✅ **BUILT** | `/reports` + risk-matrix, RED coverage, portfolio, incident analytics | All reports live and drillable |
| **5 · Admin + polish** ✅ **BUILT** | `/admin/users` role assignment, `/admin/{roles,definitions}`, global `/search`, `(app)/loading.tsx` + `error.tsx` | Admin manages roles + registry; app feels finished |

> **Status:** all phases implemented and building (`npm run build` ✅, `npm run lint` ✅). Runtime data flows require live Supabase + Microsoft wiring (README) — verified only that routes gate to `/login` without a session.

---

## 14. Decisions (resolved)

1. **vinext middleware/`next/headers`** — supported. Note Next.js 16 renamed
   `middleware.ts` → **`proxy.ts`** (with a `proxy` export); session refresh
   lives there. `next/headers` works in layouts/route handlers.
2. **RED scale** — strict **integer 0–4**, enforced in `definitionsToZod`.
3. **Residual risk** — **computed** from a transparent formula (§6), shown in
   the UI; optional analyst override is post-baseline.
4. **Access model** — **RLS, role-based** (system role on `users`); no-role =
   blocked.
5. **Rich text** — **Lexical** editor; store **Markdown** in `data`; render via
   Lexical/markdown. Output styled with the canvas prose styles.
6. **Charts** — **recharts**, themed to the style guide (§0, §7).
7. **Email** — **Resend** for transactional app email (where SSO/Supabase send
   nothing); server-side only.
8. **In-app 2FA** — not needed; MFA is inherited from Microsoft Entra SSO.

---

## 15. Explicitly out of scope (baseline)

Bulk email digests + Slack notifications (transactional email via Resend *is* in
— see §10), SSO beyond Microsoft, SCIM, **in-app 2FA** (handled by Microsoft
Entra), bulk Excel import, per-field permissions, mobile-native, public/external
sharing, AI summarisation. All post-baseline.
