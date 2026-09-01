-- ─────────────────────────────────────────────────────────────
-- Public forms + workflow engine — platform plumbing.
-- (docs/workflow-forms-plan.md §3)
--
--   • definitions gains three config kinds: form / rubric / workflow
--   • documents  — generic node attachments (private Storage bucket)
--   • settings   — app-wide singleton config (retention clocks live here)
--   • counters   — race-safe sequences for form token presets
--   • next_counter() / purge_nodes() — service-role-only functions
--
-- SECURITY MODEL: the public (anonymous) surface never touches these tables
-- directly. `anon` keeps ZERO grants; all public reads/writes go through
-- server code holding the service-role key (which bypasses RLS). Grants below
-- are therefore only for `authenticated` (team, RLS-gated) and `service_role`
-- (explicit, since new tables are no longer auto-granted).
-- ─────────────────────────────────────────────────────────────

-- ── definitions: three new config kinds ──────────────────────
alter table public.definitions drop constraint if exists definitions_kind_check;
alter table public.definitions add constraint definitions_kind_check
  check (kind in ('node', 'edge', 'form', 'rubric', 'workflow'));

-- ── documents: generic node attachments ──────────────────────
create table public.documents (
  id           text        primary key default public.nanoid(),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  node_id      text not null references public.nodes (id) on delete cascade,
  filename     text not null,
  mime_type    text not null,
  size_bytes   bigint not null,
  storage_path text not null,   -- object key in the private 'documents' bucket
  text_content text             -- extracted text (DOCX); null for PDFs (sent natively)
);

create trigger documents_touch before update on public.documents
  for each row execute function public.touch_updated_at();
create index documents_node_id_idx on public.documents (node_id);

-- ── settings: app-wide singleton config ──────────────────────
-- Key/value jsonb, read whole. First occupants: the two retention clocks
-- (retention.submission / retention.assessment), each
--   { "mode": "off" | "days" | "persist", "days": int? }.
create table public.settings (
  id         text        primary key default public.nanoid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  key        text not null unique,
  value      jsonb not null
);

create trigger settings_touch before update on public.settings
  for each row execute function public.touch_updated_at();

-- ── counters: race-safe sequences for form tokens ────────────
create table public.counters (
  id         text        primary key default public.nanoid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  key        text not null unique,   -- e.g. 'form:diagnostic'
  value      bigint not null default 0
);

create trigger counters_touch before update on public.counters
  for each row execute function public.touch_updated_at();

-- ── grants ───────────────────────────────────────────────────
-- authenticated: read documents/settings (RLS-gated); settings writes are
-- admin-only via RLS. counters have NO API-role access at all.
grant select                         on public.documents to authenticated;
grant select, insert, update, delete on public.settings  to authenticated;

-- service_role: explicit grants (new tables are not auto-exposed since 2026).
grant all on public.documents to service_role;
grant all on public.settings  to service_role;
grant all on public.counters  to service_role;
-- The public submission path (service-role server code) also reads/writes the
-- existing graph tables; make those grants explicit rather than relying on
-- legacy default privileges.
grant all on public.definitions to service_role;
grant all on public.nodes       to service_role;
grant all on public.edges       to service_role;
grant all on public.revisions   to service_role;
grant select on public.users    to service_role;

-- ── RLS ──────────────────────────────────────────────────────
alter table public.documents enable row level security;
alter table public.settings  enable row level security;
alter table public.counters  enable row level security;

create policy "documents: read" on public.documents
  for select to authenticated using (public.has_access());
-- No authenticated write policies: uploads/deletes happen only through
-- service-role server code (which bypasses RLS).

create policy "settings: read" on public.settings
  for select to authenticated using (public.has_access());
create policy "settings: write" on public.settings
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- counters: RLS enabled, no policies → no API-role access (service role only).

-- ── next_counter(): atomic per-key sequence ──────────────────
create or replace function public.next_counter(p_key text)
returns bigint
language sql
security definer
set search_path = ''
as $$
  insert into public.counters as c (key, value) values (p_key, 1)
  on conflict (key) do update set value = c.value + 1
  returning value;
$$;

revoke all on function public.next_counter(text) from public, anon, authenticated;
grant execute on function public.next_counter(text) to service_role;

-- ── purge_nodes(): whole-node hard delete (retention) ────────
-- THE single sanctioned hard-delete path through the otherwise append-only
-- history: retention policies are whole-node (docs/workflow-forms-plan.md §9),
-- so a purged node takes its revisions, its edges (and THEIR revisions), and
-- its documents rows with it, atomically. Storage OBJECTS are removed by the
-- purge cron (worker `scheduled` handler) before it calls this — SQL cannot
-- delete the underlying files.
create or replace function public.purge_nodes(p_ids text[])
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_edge_ids text[];
  v_count    int;
begin
  select coalesce(array_agg(id), '{}') into v_edge_ids
    from public.edges
   where from_id = any (p_ids) or to_id = any (p_ids);

  delete from public.revisions
   where (target_kind = 'node' and target_id = any (p_ids))
      or (target_kind = 'edge' and target_id = any (v_edge_ids));

  -- documents + edges rows go via FK cascade from nodes.
  delete from public.nodes where id = any (p_ids);
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function public.purge_nodes(text[]) from public, anon, authenticated;
grant execute on function public.purge_nodes(text[]) to service_role;

-- ── Storage: private bucket for uploaded documents ───────────
insert into storage.buckets (id, name, public)
values ('documents', 'documents', false)
on conflict (id) do nothing;
-- No storage.objects policies: only the service-role key touches this bucket.

-- ── seed the retention settings ──────────────────────────────
insert into public.settings (key, value) values
  ('retention.submission', '{"mode": "days", "days": 1}'::jsonb),
  ('retention.assessment', '{"mode": "persist"}'::jsonb)
on conflict (key) do nothing;
