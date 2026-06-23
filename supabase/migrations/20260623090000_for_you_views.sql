-- ─────────────────────────────────────────────────────────────
-- "For You": per-user configuration for the personalised /for-you table
-- (which columns / node types to show). Mirrors the per-user `dashboards`
-- pattern — owner-scoped RLS via the existing `current_user_id()` helper
-- (defined in the dashboards migration), lazily created on first save.
--
-- The domain graph (nodes/edges) is untouched; this is infra-tier UI config.
-- New public tables are NOT auto-exposed to the Data API (2026 change), so we
-- GRANT to `authenticated` explicitly; `anon` gets nothing.
-- ─────────────────────────────────────────────────────────────

create table public.for_you_views (
  id          text        primary key default public.nanoid(),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  user_id     text        not null references public.users (id) on delete cascade,
  is_default  boolean     not null default true,
  config      jsonb       not null default '{}'::jsonb,   -- { columns?: string[]; types?: string[] }
  deleted_at  timestamptz
);

create trigger touch_for_you_views before update on public.for_you_views
  for each row execute function public.touch_updated_at();

create index for_you_views_user_idx on public.for_you_views (user_id) where deleted_at is null;

alter table public.for_you_views enable row level security;

grant select, insert, update, delete on public.for_you_views to authenticated;

create policy "for_you_views: read own" on public.for_you_views
  for select to authenticated
  using ( user_id = public.current_user_id() );

create policy "for_you_views: insert own" on public.for_you_views
  for insert to authenticated
  with check ( user_id = public.current_user_id() );

create policy "for_you_views: update own" on public.for_you_views
  for update to authenticated
  using      ( user_id = public.current_user_id() )
  with check ( user_id = public.current_user_id() );

create policy "for_you_views: delete own" on public.for_you_views
  for delete to authenticated
  using ( user_id = public.current_user_id() );
