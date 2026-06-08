-- The email-domain allowlist is enforced in the app's /auth/callback route
-- (env VITE_ALLOWED_EMAIL_DOMAINS). Hosted Supabase does not permit setting a
-- custom database GUC (`alter database ... set app.allowed_email_domains` →
-- "permission denied to set parameter"), so handle_new_user no longer reads it
-- and just provisions the profile. create-or-replace re-grants EXECUTE to
-- PUBLIC by default, so we re-apply the revoke.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.users (auth_id, email, name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data ->> 'name', new.email))
  on conflict (auth_id) do nothing;
  return new;
end;
$$;

revoke all on function public.handle_new_user() from public, anon, authenticated;
