# Customisable per-user dashboards — implementation plan

> Status: approved direction (decisions confirmed 2026-06-08). Each user builds
> their **own** dashboard from a gallery of configurable **widgets** (single
> number, table, donut, bar, stacked bar, line, plus presets like the risk
> matrix and a markdown note). A new user starts from an **empty** board and
> adds widgets via a **multi-step builder** (pick a presentation type → choose
> source/fields → options). Persisted per user in Supabase **from day one**.

## Confirmed decisions

1. **Persistence:** Supabase `dashboards` table from day one (no localStorage stage).
2. **Grid:** `react-grid-layout` (drag + resize + responsive).
3. **Adding widgets:** empty by default; an **Add widget** button opens a multi-step
   form — **step 1 = presentation type** (single number, table, donut, bar, stacked
   bar, line, …), **step 2 = source + the appropriate fields/measure**, step 3 = options.
4. **Default layout:** none. New users get `null`/empty and build their own.
5. **Org templates:** out of scope for now.

## 1. Principles

- **Per-user, owner-scoped.** Each user owns and edits only their dashboard(s); RLS
  enforces it. No cross-user visibility, no seeded/org defaults (for now).
- **Generic, configurable widgets — not one-off metrics.** A widget's *type* is a
  **presentation** (KPI / table / donut / bar / stacked-bar / line / risk-matrix /
  note). What it shows is **config** (source node type, measure, group-by, filters,
  time bucket). One "bar chart" widget can chart risks-by-status, incidents-by-severity,
  initiatives-by-priority… — chosen in the builder. Adding a *new chart kind* = one
  registry entry; adding a *new chart instance* = pure user data.
- **Reuse the engine.** Aggregation reuses `listNodes`/`listEdgesByType`
  (`src/lib/nodes/queries.ts`) + `src/lib/red.ts`; charts reuse **recharts** (as
  `RedTrend` does) + the RED ramp tokens; UI reuses `Modal`/`Select`/`DatePicker`/
  `Confirm`/`EmptyState`; field pickers reuse the definitions metadata (`fieldsOf`,
  `FieldDef`) so the builder knows each source's fields and their `data_type`.
- **On-brand & conventions intact.** Ultra-dark canvas, hairlines, mono labels,
  orange-only accent, deterministic chart colours (spec §9.1). Domain graph
  (`nodes`/`edges`) untouched; dashboards are infra config (like `users`), with their
  own table following every DB rule.

## 2. Architecture

| Concern | Where | Notes |
|---|---|---|
| **Widget catalog** (presentation types: component, default size, builder steps, loader) | code registry `src/lib/dashboard/widgets.tsx` | small fixed set; a chart is a React component |
| **Aggregation engine** (source + filters + group-by + measure + time bucket → series) | server `src/lib/dashboard/aggregate.ts` | one generic function reused by all data widgets |
| **Widget instances** (which widgets, where, sized how, with what config) | data: `dashboards.layout` jsonb, per user | the customisation; no migration to add an instance |

## 3. Data model

### 3.1 Widget instance

```ts
interface WidgetInstance {
  id: string;              // nanoid, unique within the dashboard
  type: WidgetType;        // 'kpi' | 'table' | 'donut' | 'bar' | 'stacked-bar' | 'line' | 'risk-matrix' | 'note'
  title?: string;          // user title override
  x: number; y: number; w: number; h: number; // react-grid-layout coords
  config: WidgetConfig;    // shape depends on type (see §5)
}
```

### 3.2 `dashboards` table (from day one)

```sql
create table public.dashboards (
  id          text        primary key default public.nanoid(),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  user_id     text        not null references public.users(id) on delete cascade,
  name        text        not null default 'My dashboard',
  is_default  boolean     not null default true,
  layout      jsonb       not null default '[]'::jsonb,  -- WidgetInstance[]
  deleted_at  timestamptz
);
create trigger touch_dashboards before update on public.dashboards
  for each row execute function public.touch_updated_at();
create index on public.dashboards (user_id) where deleted_at is null;
```

`name`/`is_default` are first-class columns (infra config like `users`, not a typed
domain node); `layout` is read whole, never queried column-wise. Multiple rows per
user are allowed, so "multiple named dashboards" later needs no schema change. v1
uses a single `is_default` row, **created lazily on the user's first widget add** (no
seeding). If a user has no row, the UI shows the empty state.

**RLS — own-row only**, using a new owner helper that mirrors the existing
`user_role()` idiom (SECURITY DEFINER, `search_path=''`, EXECUTE revoked from
public/anon, granted to authenticated):

```sql
create or replace function public.current_user_id()
returns text language sql stable security definer set search_path = '' as $$
  select id from public.users where auth_id = (select auth.uid());
$$;
revoke all on function public.current_user_id() from public, anon;
grant execute on function public.current_user_id() to authenticated;

alter table public.dashboards enable row level security;
grant select, insert, update, delete on public.dashboards to authenticated; -- 2026 Data API rule

create policy "dashboards: read own"   on public.dashboards for select to authenticated
  using ( user_id = public.current_user_id() );
create policy "dashboards: insert own" on public.dashboards for insert to authenticated
  with check ( user_id = public.current_user_id() );
create policy "dashboards: update own" on public.dashboards for update to authenticated
  using ( user_id = public.current_user_id() ) with check ( user_id = public.current_user_id() );
create policy "dashboards: delete own" on public.dashboards for delete to authenticated
  using ( user_id = public.current_user_id() );
```

Writes go through server actions (`loadDashboard`, `saveDashboard(layout)`) in
`src/lib/dashboard/actions.ts` using the server client (RLS applies). `saveDashboard`
upserts the caller's default row (insert if none). No revision history needed for layouts.

## 4. Widget catalog (code registry)

```ts
export type WidgetType = 'kpi' | 'table' | 'donut' | 'bar' | 'stacked-bar' | 'line' | 'risk-matrix' | 'note';

export interface WidgetDef {
  type: WidgetType;
  title: string;             // gallery label, e.g. "Bar chart"
  description: string;
  category: 'number' | 'table' | 'chart' | 'preset' | 'content';
  icon: ComponentType;
  defaultSize: { w: number; h: number };
  minSize?: { w: number; h: number };
  builder: BuilderStep[];    // the multi-step form spec for step 2+ (see §6)
  load?: (config: WidgetConfig) => Promise<unknown>; // server action; omit for 'note'
  Component: ComponentType<{ instance: WidgetInstance; data: unknown; editing: boolean }>;
}
```

The catalog is small and fixed: KPI, Table, Donut, Bar, Stacked bar, Line, Risk
matrix (preset), Note. Each data widget delegates fetching to the **aggregation
engine** via its `load`.

## 5. Config shapes (per presentation type)

```ts
type Source = 'initiative' | 'risk' | 'incident';
type Measure =
  | { kind: 'count' }
  | { kind: 'sum' | 'avg' | 'min' | 'max'; field: string };   // numeric field
interface Filter { field: string; op: 'eq'|'neq'|'contains'|'gte'|'lte'|'between'; value: string|number|[unknown,unknown] }

type WidgetConfig =
  | { type:'kpi';         source: Source; measure: Measure; filters: Filter[] }
  | { type:'table';       source: Source; columns: string[]; sort?: {field:string;dir:'asc'|'desc'}; filters: Filter[]; limit?: number }
  | { type:'donut'|'bar'; source: Source; groupBy: string; measure: Measure; filters: Filter[] }
  | { type:'stacked-bar'; source: Source; groupBy: string; series: string; measure: Measure; filters: Filter[] }
  | { type:'line';        source: Source; timeField: string; bucket:'day'|'week'|'month'; measure: Measure; series?: string; filters: Filter[] }
  | { type:'risk-matrix'; filters: Filter[] }   // preset: risks, likelihood × impact
  | { type:'note';        markdown: string };   // uses the RichText editor
```

## 6. The add-widget builder (multi-step)

A wizard inside `Modal` (`src/components/dashboard/WidgetBuilder.tsx`):

1. **Presentation type** — a gallery grid of the catalog (icon + name + description):
   Single number · Table · Donut · Bar · Stacked bar · Line · Risk matrix · Note.
2. **Data** — fields rendered from the chosen type's `builder` spec, *aware of the
   chosen source's fields* (from `fieldsOf(definition)`), e.g.:
   - KPI → Source · Measure (Count, or Sum/Avg/Min/Max of a numeric field) · Filters
   - Table → Source · Columns (multi-select + drag order, reusing the export modal's
     pattern) · Sort · Filters · Row limit
   - Donut/Bar → Source · Group by (enum/text field) · Measure · Filters
   - Stacked bar → + Series (second category) 
   - Line → Source · Time field (created/updated/date field) · Bucket · Measure · optional Series
   - Risk matrix → just Filters (source fixed to risks)
   - Note → a `RichText` editor
3. **Options & preview** — title, size, and a live preview; "Add to dashboard" places it.

`Select`/`DatePicker`/checkboxes/`TagInput` power the inputs; group-by/measure field
lists come from the source definition so only valid fields appear. Simple scalar
options (title, limit, bucket) can reuse `FieldInput`. Edit-an-existing-widget reuses
the same builder pre-filled (gear icon on the card).

## 7. Aggregation engine

`src/lib/dashboard/aggregate.ts` (server) — one function the data widgets share:

```ts
async function aggregate(config): Promise<{ rows: NodeRow[] } | Series>  // shape per widget
```

- Loads `listNodes(source)` (RLS applies), applies `filters` in memory (reusing the
  export modal's typed predicates), then:
  - **kpi** → reduce to a single number (count or numeric agg).
  - **table** → project `columns`, sort, limit.
  - **donut/bar** → group by `groupBy`, aggregate `measure` → `[{label, value}]`.
  - **stacked-bar** → group by `groupBy` × `series` → stacked series.
  - **line** → bucket by `timeField`/`bucket`, aggregate → time series (optionally split by `series`).
  - **risk-matrix** → the existing likelihood×impact bucketing (see Fix #3) with risk lists per cell.
- Wrapped in React `cache()` so widgets sharing a source don't refetch. Enum labels and
  number word-labels (`options.labels`) are resolved for display.

## 8. Layout & grid (react-grid-layout)

- `DashboardGrid.tsx` (client) wraps `react-grid-layout` (Responsive + WidthProvider),
  themed to the canvas (hairline placeholder, square resize handle, no shadow/radius).
- **Edit mode**: a `Customise` button toggles drag/resize + per-card gear (edit) and ×
  (remove) + an `Add widget` button. `Done` saves (debounced `saveDashboard`).
  `react-grid-layout`'s `onLayoutChange` maps back into `WidgetInstance` x/y/w/h.
- **Empty state**: no widgets → `EmptyState` ("Your dashboard is empty") + an `Add
  widget` CTA (the builder).
- Charts render client-side; the shell (RSC at `/`) fetches each widget's `load()` data
  and passes it in (or widgets fetch via server action on mount for live refresh).

## 9. Security & RLS

- Own-row policies (above); UPDATE carries both `using` + `with check`.
- `current_user_id()` is the only new SECURITY DEFINER fn → `search_path=''`, EXECUTE
  revoked from public/anon; run `supabase db advisors` after.
- Widget `load()`/`aggregate()` accept only a validated `WidgetType` + typed config
  (source ∈ allowed set, fields validated against the source definition) — never raw
  SQL or table names. All reads go through query helpers, so RLS gates every fetch.

## 10. Theming

- Card chrome = hairline (`var(--line)`), mono uppercase title, no radius/shadow.
- recharts: axes/grid `var(--line)`, series `--accent` / RED ramp `--accent-1/2/3`,
  themed tooltips; re-read tokens on `themechange` like `RedTrend`. Per-widget empty/
  loading/error via `EmptyState` + skeleton.

## 11. Phasing

- **Phase 1 — Foundation + first widgets.** `dashboards` table + RLS + `current_user_id()`;
  `loadDashboard`/`saveDashboard`; `react-grid-layout` grid with empty state, Customise/
  Add, drag/resize/remove; widget registry + `WidgetCard`; aggregation engine; the
  **builder wizard**; ship **KPI** and **Table** end-to-end. Wire `/` to the grid.
- **Phase 2 — Charts.** Donut, Bar, Stacked bar, Line via recharts + their builder steps.
- **Phase 3 — Presets & content.** Risk-matrix preset widget (post Fix #3), Note (RichText),
  list widgets (recent activity / my assignments), quick links.
- **Phase 4 — Polish.** Responsive breakpoints, per-widget refresh, error states, DnD
  keyboard fallback, optional multiple named dashboards (table already supports it).

## 12. Files to create / modify

Create:
- `supabase/migrations/…_dashboards.sql` — table, trigger, grants, RLS, `current_user_id()`
- `src/lib/dashboard/widgets.tsx` — registry + types
- `src/lib/dashboard/aggregate.ts` — aggregation engine (server)
- `src/lib/dashboard/actions.ts` — `loadDashboard` / `saveDashboard`
- `src/components/dashboard/DashboardGrid.tsx` — grid + edit mode
- `src/components/dashboard/WidgetCard.tsx` — chrome (title, gear, ×, empty/loading)
- `src/components/dashboard/WidgetBuilder.tsx` — multi-step add/edit wizard
- `src/components/dashboard/widgets/*` — one component per presentation type

Modify:
- `src/app/(app)/page.tsx` — render `DashboardGrid` (the current static dashboard can
  move to a `/reports`-style overview or be retired)
- `package.json` — add `react-grid-layout`
- `CLAUDE.md` — document the dashboards table + widget registry once built

## 13. Risks & mitigations

- **Resizable grid** → proven lib (`react-grid-layout`); storage stays lib-agnostic (§3.1).
- **Chart SSR** → widgets are client components; shell supplies initial data.
- **Data fan-out** (many widgets) → `cache()` + shared source loads; cap widgets; lazy-load.
- **Per-user RLS slips** → single ownership helper, both UPDATE clauses, advisors run.
- **DnD a11y** → native DnD/grid drag isn't keyboard-accessible; provide a non-drag
  fallback (a "move/size" menu) and keep Add/remove/config keyboard-reachable.
- **Unknown widget type** (registry change) → render a graceful "unknown widget" tile
  with remove; validate `type` on load.
```
