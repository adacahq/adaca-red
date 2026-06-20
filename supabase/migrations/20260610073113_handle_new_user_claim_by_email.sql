-- ─────────────────────────────────────────────────────────────
-- handle_new_user: claim a pre-seeded stub profile by email.
--
-- We pre-seed `users` rows (name + email, auth_id NULL) for the people named
-- as owners in the weekly pack, so assignments can reference them before they
-- have ever signed in. The PREVIOUS trigger only de-duped on `auth_id`, so a
-- first SSO login for a pre-seeded email would hit the `users.email` UNIQUE
-- constraint and ERROR — blocking that person's login.
--
-- New behaviour: if an unclaimed stub (same email, auth_id IS NULL) exists,
-- bind it to the new auth user; otherwise provision a fresh profile. The stub's
-- `role` and any existing `name` are preserved. Still SECURITY DEFINER with an
-- empty search_path; EXECUTE stays revoked from API roles.
-- ─────────────────────────────────────────────────────────────

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_claimed int;
begin
  -- Claim a pre-seeded stub (same email, not yet linked to an auth user).
  update public.users
     set auth_id = new.id,
         name    = coalesce(name, new.raw_user_meta_data ->> 'name', new.email)
   where email = new.email
     and auth_id is null;
  get diagnostics v_claimed = row_count;

  -- No stub to claim → provision a fresh profile.
  if v_claimed = 0 then
    insert into public.users (auth_id, email, name)
    values (new.id, new.email, coalesce(new.raw_user_meta_data ->> 'name', new.email))
    on conflict (auth_id) do nothing;
  end if;

  return new;
end;
$$;

-- create-or-replace re-grants EXECUTE to PUBLIC by default; re-apply the revoke.
revoke all on function public.handle_new_user() from public, anon, authenticated;
