-- ─────────────────────────────────────────────────────────────
-- RLS, Data-API grants, role helpers, and the Auth → users link.
--
-- AUTH MODEL: sign-in is Microsoft (Azure) OAuth via Supabase Auth. There is
-- no sign-up — a profile is provisioned just-in-time on first login by the
-- handle_new_user() trigger, which also enforces the email-domain allowlist
-- (defence-in-depth alongside the app-layer check). New users get NO system
-- role, so they are blocked until an admin/owner assigns one.
--
-- ACCESS MODEL (RLS, role-based): the system role on public.users gates
-- everything.
--   • role NULL          → no access (blocker page; RLS denies all data)
--   • viewer             → read-only
--   • member             → read + write nodes/edges/assignments
--   • owner / admin      → member + manage reference data (definitions/roles)
--                          and assign roles (via set_user_role)
--
-- Since April 2026 new public tables are NOT auto-exposed to the Data API, so
-- we GRANT to `authenticated` explicitly; RLS then restricts by role. `anon`
-- gets nothing.
-- ─────────────────────────────────────────────────────────────

grant usage on schema public to authenticated;

grant select, insert, update, delete on public.definitions to authenticated;  -- writes gated to admins by RLS
grant select, insert, update, delete on public.roles       to authenticated;  -- writes gated to admins by RLS
grant select                         on public.users       to authenticated;
grant update (name)                  on public.users       to authenticated;  -- column-level: never `role` (anti-escalation)
grant select, insert, update, delete on public.nodes       to authenticated;
grant select, insert, update, delete on public.edges       to authenticated;
grant select, insert, update, delete on public.assignments to authenticated;
grant select, insert                 on public.revisions   to authenticated;  -- append-only

-- ── role helpers ─────────────────────────────────────────────
-- user_role() is SECURITY DEFINER so it can read public.users WITHOUT tripping
-- that table's own RLS (otherwise the users SELECT policy below would recurse).
-- It only ever returns the CALLER's own role — minimal surface. The boolean
-- helpers build on it and are what the policies call.
create or replace function public.user_role()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select role from public.users where auth_id = (select auth.uid());
$$;

create or replace function public.has_access()
returns boolean language sql stable security invoker set search_path = '' as $$
  select public.user_role() is not null;
$$;

create or replace function public.can_write()
returns boolean language sql stable security invoker set search_path = '' as $$
  select public.user_role() in ('admin', 'owner', 'member');
$$;

create or replace function public.is_admin()
returns boolean language sql stable security invoker set search_path = '' as $$
  select public.user_role() in ('admin', 'owner');
$$;

revoke all on function public.user_role()  from public, anon;
revoke all on function public.has_access()  from public, anon;
revoke all on function public.can_write()  from public, anon;
revoke all on function public.is_admin()   from public, anon;
grant execute on function public.user_role()  to authenticated;
grant execute on function public.has_access() to authenticated;
grant execute on function public.can_write()  to authenticated;
grant execute on function public.is_admin()   to authenticated;

-- ── Enable RLS on every table ────────────────────────────────
alter table public.definitions enable row level security;
alter table public.roles       enable row level security;
alter table public.users       enable row level security;
alter table public.nodes       enable row level security;
alter table public.edges       enable row level security;
alter table public.assignments enable row level security;
alter table public.revisions   enable row level security;

-- ── definitions / roles: read for anyone with access, write = admin ──
create policy "definitions: read"  on public.definitions for select to authenticated using (public.has_access());
create policy "definitions: write" on public.definitions for all    to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "roles: read"        on public.roles       for select to authenticated using (public.has_access());
create policy "roles: write"       on public.roles       for all    to authenticated using (public.is_admin()) with check (public.is_admin());

-- ── users: read own row always (so the blocker page can see role=null);
--    read the directory if you have access; self-update is name only (the
--    column grant blocks `role`); role changes go through set_user_role(). ──
create policy "users: read" on public.users
  for select to authenticated
  using ( (select auth.uid()) = auth_id or public.has_access() );
create policy "users: update self" on public.users
  for update to authenticated
  using      ( (select auth.uid()) = auth_id )
  with check ( (select auth.uid()) = auth_id );

-- ── nodes / edges / assignments: read = access, write = member+ ──
create policy "nodes: read"  on public.nodes for select to authenticated using (public.has_access());
create policy "nodes: write" on public.nodes for all    to authenticated using (public.can_write()) with check (public.can_write());
create policy "edges: read"  on public.edges for select to authenticated using (public.has_access());
create policy "edges: write" on public.edges for all    to authenticated using (public.can_write()) with check (public.can_write());
create policy "assignments: read"  on public.assignments for select to authenticated using (public.has_access());
create policy "assignments: write" on public.assignments for all    to authenticated using (public.can_write()) with check (public.can_write());

-- ── revisions: read = access, append-only for writers ────────
create policy "revisions: read"   on public.revisions for select to authenticated using (public.has_access());
create policy "revisions: append" on public.revisions for insert to authenticated with check (public.can_write());

-- ── admin: assign a system role ──────────────────────────────
-- SECURITY DEFINER so it can write `role` (which the column grant withholds
-- from users). Self-checks the caller is an admin; validates the role.
create or replace function public.set_user_role(target_user_id text, new_role text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'not authorized';
  end if;
  if new_role is not null and new_role not in ('admin', 'owner', 'member', 'viewer') then
    raise exception 'invalid role: %', new_role;
  end if;
  update public.users set role = new_role where id = target_user_id;
end;
$$;

revoke all on function public.set_user_role(text, text) from public, anon;
grant execute on function public.set_user_role(text, text) to authenticated;

-- ── Auth → users link (JIT provisioning + domain allowlist) ──
-- A new auth.users row mints a matching public.users profile (role left NULL).
-- The email-domain allowlist is read from the `app.allowed_email_domains`
-- database setting (comma-separated, e.g. 'adaca.com'); when set, a non-matching
-- domain is rejected here too — defence-in-depth behind the app-layer check.
-- SECURITY DEFINER (writes public.users from the auth-admin context), locked
-- down: search_path '', EXECUTE revoked from API roles, raw_user_meta_data used
-- only for a display name (never for authz).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  allowed text := current_setting('app.allowed_email_domains', true);
  domain  text := lower(split_part(coalesce(new.email, ''), '@', 2));
begin
  if allowed is not null and allowed <> '' then
    if not (domain = any (string_to_array(lower(replace(allowed, ' ', '')), ','))) then
      raise exception 'Email domain % is not permitted', domain;
    end if;
  end if;

  insert into public.users (auth_id, email, name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data ->> 'name', new.email))
  on conflict (auth_id) do nothing;
  return new;
end;
$$;

revoke all on function public.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
