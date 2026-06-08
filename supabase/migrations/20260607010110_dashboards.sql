-- ─────────────────────────────────────────────────────────────
-- Per-user customisable dashboards.
--
-- A dashboard is owned by a user and holds an ordered set of widget
-- instances in `layout` (jsonb, read whole). Infra config (like `users`),
-- not a domain node — but it still follows every table rule: id/created_at/
-- updated_at first, nanoid id, plural name, touch trigger, soft delete,
-- owner-scoped RLS.
-- ─────────────────────────────────────────────────────────────

-- Resolve the caller's public.users.id from their auth uid, without tripping
-- RLS recursion — mirrors public.user_role().
create or replace function public.current_user_id()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select id from public.users where auth_id = (select auth.uid());
$$;

revoke all on function public.current_user_id() from public, anon;
grant execute on function public.current_user_id() to authenticated;

create table public.dashboards (
  id          text        primary key default public.nanoid(),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  user_id     text        not null references public.users (id) on delete cascade,
  name        text        not null default 'My dashboard',
  is_default  boolean     not null default true,
  layout      jsonb       not null default '[]'::jsonb,   -- WidgetInstance[]
  deleted_at  timestamptz
);

create trigger touch_dashboards before update on public.dashboards
  for each row execute function public.touch_updated_at();

create index dashboards_user_idx on public.dashboards (user_id) where deleted_at is null;

-- ── RLS: own-row only ────────────────────────────────────────
alter table public.dashboards enable row level security;

-- New public tables are NOT auto-exposed to the Data API (2026) — grant explicitly.
grant select, insert, update, delete on public.dashboards to authenticated;

create policy "dashboards: read own" on public.dashboards
  for select to authenticated
  using ( user_id = public.current_user_id() );

create policy "dashboards: insert own" on public.dashboards
  for insert to authenticated
  with check ( user_id = public.current_user_id() );

create policy "dashboards: update own" on public.dashboards
  for update to authenticated
  using      ( user_id = public.current_user_id() )
  with check ( user_id = public.current_user_id() );

create policy "dashboards: delete own" on public.dashboards
  for delete to authenticated
  using ( user_id = public.current_user_id() );
