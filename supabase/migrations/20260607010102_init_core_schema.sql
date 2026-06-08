-- ─────────────────────────────────────────────────────────────
-- Core schema — a definitions-driven graph of operational objects.
--
-- 7 tables. CONVENTIONS (strict, enforced everywhere):
--   • Every table's first three columns are  id, created_at, updated_at.
--   • id = nanoid()  (10-char [0-9a-z], text).
--   • created_at / updated_at = timestamptz default now(); updated_at is
--     maintained by the touch_updated_at() trigger.
--
-- SHAPE:
--   definitions  node & edge TYPES + their field structure (in `config` jsonb)
--   roles        attribution roles (owner/assignee/…)
--   users        app profile, linked 1:1 to auth.users
--   nodes        initiatives / groups / tasks / risks / incidents …
--                containment hierarchy via parent_id (single parent, ∞ depth)
--   edges        association graph (Initiative—RED→Risk, Incident—Risk, …)
--   assignments  user ↔ node, with a role
--   revisions    immutable history snapshots for nodes AND edges
-- ─────────────────────────────────────────────────────────────

-- ── definitions: the merged type + field registry ────────────
-- One row per node-type or edge-type. The field structure (for form/filter/
-- validation generation), allowed parents, and edge from/to live in `config`
-- jsonb — deliberately NOT normalised; it's read whole by the app, never
-- queried column-wise.
create table public.definitions (
  id         text        primary key default public.nanoid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  kind       text not null check (kind in ('node', 'edge')),
  key        text not null unique,
  label      text not null,
  config     jsonb not null default '{}'::jsonb
);

-- ── roles: attribution roles, definitions-driven ─────────────
create table public.roles (
  id         text        primary key default public.nanoid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  key        text not null unique,
  label      text not null,
  config     jsonb not null default '{}'::jsonb
);

-- ── users: app profile linked to Supabase Auth ───────────────
create table public.users (
  id         text        primary key default public.nanoid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  auth_id    uuid unique references auth.users (id) on delete cascade,
  name       text,
  email      text unique,
  -- System (top-level) role that gates app access. NULL = no access yet → the
  -- user lands on the "role not assigned" blocker until an admin/owner grants
  -- one. Distinct from the per-node attribution roles in `roles`/`assignments`.
  role       text check (role in ('admin', 'owner', 'member', 'viewer'))
);

-- ── nodes: the containment tree of operational objects ───────
create table public.nodes (
  id          text        primary key default public.nanoid(),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  type_key    text not null references public.definitions (key),
  parent_id   text references public.nodes (id) on delete cascade,
  position    int  not null default 0,
  data        jsonb not null default '{}'::jsonb,   -- title, status, all typed fields
  current_rev int  not null default 1,
  created_by  text references public.users (id),
  deleted_at  timestamptz
);

-- ── edges: the association graph (RED lives on 'mitigates') ───
create table public.edges (
  id          text        primary key default public.nanoid(),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  type_key    text not null references public.definitions (key),
  from_id     text not null references public.nodes (id) on delete cascade,
  to_id       text not null references public.nodes (id) on delete cascade,
  data        jsonb not null default '{}'::jsonb,   -- RED = {relevance,extent,duration,assessmentDate}
  current_rev int  not null default 1,
  created_by  text references public.users (id),
  deleted_at  timestamptz,
  unique (from_id, to_id, type_key)                 -- re-scoring is a revision, not a new row
);

-- ── assignments: owners / assignees / reviewers ──────────────
create table public.assignments (
  id         text        primary key default public.nanoid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  node_id    text not null references public.nodes (id) on delete cascade,
  user_id    text not null references public.users (id) on delete cascade,
  role_key   text not null references public.roles (key),
  unique (node_id, user_id, role_key)
);

-- ── revisions: append-only history for nodes AND edges ───────
-- A 'mitigates' edge's revisions ARE the RED-over-time trend.
create table public.revisions (
  id          text        primary key default public.nanoid(),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  target_kind text not null check (target_kind in ('node', 'edge')),
  target_id   text not null,
  rev_no      int  not null,
  data        jsonb not null,
  author_id   text references public.users (id),
  change_note text,
  unique (target_kind, target_id, rev_no)
);

-- ── updated_at triggers (one per table) ──────────────────────
create trigger definitions_touch before update on public.definitions
  for each row execute function public.touch_updated_at();
create trigger roles_touch before update on public.roles
  for each row execute function public.touch_updated_at();
create trigger users_touch before update on public.users
  for each row execute function public.touch_updated_at();
create trigger nodes_touch before update on public.nodes
  for each row execute function public.touch_updated_at();
create trigger edges_touch before update on public.edges
  for each row execute function public.touch_updated_at();
create trigger assignments_touch before update on public.assignments
  for each row execute function public.touch_updated_at();
create trigger revisions_touch before update on public.revisions
  for each row execute function public.touch_updated_at();

-- ── indexes ──────────────────────────────────────────────────
create index nodes_type_key_idx   on public.nodes (type_key);
create index nodes_parent_id_idx  on public.nodes (parent_id);
create index nodes_data_gin       on public.nodes using gin (data);
create index edges_type_key_idx   on public.edges (type_key);
create index edges_from_id_idx    on public.edges (from_id);
create index edges_to_id_idx      on public.edges (to_id);
create index edges_data_gin       on public.edges using gin (data);
create index assignments_node_idx on public.assignments (node_id);
create index assignments_user_idx on public.assignments (user_id);
create index revisions_target_idx on public.revisions (target_kind, target_id);
