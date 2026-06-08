-- ─────────────────────────────────────────────────────────────
-- Mutation RPCs — the single write path for nodes & edges.
--
-- Each create/update snapshots into `revisions` and bumps `current_rev`
-- ATOMICALLY. SECURITY INVOKER so RLS still applies (a viewer's write is
-- rejected by the can_write() policies; the author is the caller's users.id).
-- ─────────────────────────────────────────────────────────────

create or replace function public.save_node(
  p_id          text,
  p_type        text,
  p_parent      text,
  p_data        jsonb,
  p_position    int  default 0,
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
    insert into public.nodes (type_key, parent_id, data, position, created_by, current_rev)
    values (p_type, p_parent, coalesce(p_data, '{}'::jsonb), coalesce(p_position, 0), v_author, 1)
    returning id into v_id;
    insert into public.revisions (target_kind, target_id, rev_no, data, author_id, change_note)
    values ('node', v_id, 1, coalesce(p_data, '{}'::jsonb), v_author, p_change_note);
  else
    update public.nodes
       set data        = coalesce(p_data, data),
           parent_id   = p_parent,
           position    = coalesce(p_position, position),
           current_rev = current_rev + 1
     where id = v_id
     returning current_rev into v_rev;
    insert into public.revisions (target_kind, target_id, rev_no, data, author_id, change_note)
    values ('node', v_id, v_rev, coalesce(p_data, '{}'::jsonb), v_author, p_change_note);
  end if;

  return v_id;
end;
$$;

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
    returning id into v_id;
    insert into public.revisions (target_kind, target_id, rev_no, data, author_id, change_note)
    values ('edge', v_id, 1, coalesce(p_data, '{}'::jsonb), v_author, p_change_note);
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

-- Soft-delete a node and its whole subtree.
create or replace function public.soft_delete_node(p_id text)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  with recursive sub as (
    select id from public.nodes where id = p_id
    union all
    select n.id from public.nodes n join sub on n.parent_id = sub.id
  )
  update public.nodes set deleted_at = now()
   where id in (select id from sub) and deleted_at is null;
end;
$$;

create or replace function public.soft_delete_edge(p_id text)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  update public.edges set deleted_at = now() where id = p_id;
end;
$$;
