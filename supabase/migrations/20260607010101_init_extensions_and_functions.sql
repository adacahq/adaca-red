-- ─────────────────────────────────────────────────────────────
-- Extensions + shared helper functions
--
-- nanoid()           → the project-wide id generator: 10-char lowercase
--                      alphanumeric [0-9a-z]. Default for the `id` column
--                      on EVERY table.
-- touch_updated_at() → trigger fn that keeps `updated_at` honest on UPDATE.
-- ─────────────────────────────────────────────────────────────

-- pgcrypto provides gen_random_bytes(); Supabase installs it in `extensions`.
create extension if not exists pgcrypto with schema extensions;

-- ── nanoid: 10-char [0-9a-z] ─────────────────────────────────
-- search_path is locked to '' (advisor-clean). pg_catalog is always
-- implicitly searched, so length()/substr()/get_byte() resolve; the only
-- non-catalog call (gen_random_bytes) is schema-qualified.
create or replace function public.nanoid(
  size int default 10,
  alphabet text default '0123456789abcdefghijklmnopqrstuvwxyz'
)
returns text
language plpgsql
volatile
set search_path = ''
as $$
declare
  result text := '';
  i int := 0;
  n int := length(alphabet);
  bytes bytea;
begin
  bytes := extensions.gen_random_bytes(size);
  while i < size loop
    result := result || substr(alphabet, (get_byte(bytes, i) % n) + 1, 1);
    i := i + 1;
  end loop;
  return result;
end;
$$;

-- ── updated_at trigger fn ────────────────────────────────────
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;
