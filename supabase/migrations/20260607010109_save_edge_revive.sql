-- ─────────────────────────────────────────────────────────────
-- Fix: re-creating an edge that matches a soft-deleted (or live) row on the
-- unique key (from_id, to_id, type_key) must NOT error.
--
-- Soft-deleting an edge leaves the row in place (deleted_at set), but the
-- unique constraint still counts it. A plain INSERT for the same pair then
-- fails. That breaks the common flow: unlink a mitigation, then link it again.
--
-- The unique constraint is intentional — one row per (from, to, type), whose
-- revisions ARE the RED-over-time trend. So on conflict we REVIVE/re-score the
-- existing row in place (clear deleted_at, bump current_rev, append a revision)
-- rather than inserting a duplicate. This also makes "create over an existing
-- live edge" a re-score revision, consistent with the schema's design note.
-- ─────────────────────────────────────────────────────────────

create or replace function public.save_edge(
  p_id          text,
  p_type        text,
  p_from        text,
  p_to          text,
  p_data        jsonb,
  p_change_note text default null
)
returns text
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_author text;
  v_id     text := p_id;
  v_rev    int;
begin
  select id into v_author from public.users where auth_id = (select auth.uid());

  if v_id is null then
    insert into public.edges (type_key, from_id, to_id, data, created_by, current_rev)
    values (p_type, p_from, p_to, coalesce(p_data, '{}'::jsonb), v_author, 1)
    on conflict (from_id, to_id, type_key) do update
       set data        = coalesce(p_data, public.edges.data),
           deleted_at  = null,
           current_rev = public.edges.current_rev + 1
    returning id, current_rev into v_id, v_rev;

    insert into public.revisions (target_kind, target_id, rev_no, data, author_id, change_note)
    values ('edge', v_id, v_rev, coalesce(p_data, '{}'::jsonb), v_author, p_change_note);
  else
    update public.edges
       set data        = coalesce(p_data, data),
           current_rev = current_rev + 1
     where id = v_id
     returning current_rev into v_rev;
    insert into public.revisions (target_kind, target_id, rev_no, data, author_id, change_note)
    values ('edge', v_id, v_rev, coalesce(p_data, '{}'::jsonb), v_author, p_change_note);
  end if;

  return v_id;
end;
$$;
