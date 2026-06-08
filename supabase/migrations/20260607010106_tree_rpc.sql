-- get_subtree — a node plus all its (non-deleted) descendants, in one round
-- trip. SECURITY INVOKER so RLS applies. Used to render containment trees.
create or replace function public.get_subtree(p_root text)
returns setof public.nodes
language sql
stable
security invoker
set search_path = ''
as $$
  with recursive sub as (
    select * from public.nodes where id = p_root
    union all
    select n.* from public.nodes n join sub on n.parent_id = sub.id
  )
  select * from sub where deleted_at is null order by position;
$$;
