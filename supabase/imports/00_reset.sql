-- ─────────────────────────────────────────────────────────────
-- ONE-OFF — wipe all dummy DOMAIN data before the real import.
--
-- ⚠️  DESTRUCTIVE. Run ONCE against the linked project, AFTER the
--     status-reporting migrations are applied and BEFORE 2026-06-11.sql.
--     NOT a migration — fresh environments must never re-run this.
--
-- PRESERVES: definitions, roles, users  (reference data + real SSO profiles).
-- CLEARS:    nodes, edges, assignments, revisions, dashboards  (dummy domain
--            rows + per-user dummy dashboard layouts).
--
-- `cascade` follows the FKs (edges/assignments → nodes; dashboards → users),
-- but every target is listed explicitly so nothing is cleared by surprise.
-- revisions has no FK (target_id is loose text) so it must be named.
-- ─────────────────────────────────────────────────────────────

begin;

truncate table
  public.edges,
  public.assignments,
  public.revisions,
  public.nodes,
  public.dashboards
cascade;

-- Sanity: confirm reference data survived and domain tables are empty.
do $$
declare
  n_nodes int; n_defs int; n_users int;
begin
  select count(*) into n_nodes from public.nodes;
  select count(*) into n_defs  from public.definitions;
  select count(*) into n_users from public.users;
  raise notice 'after reset: nodes=% (expect 0), definitions=% (preserved), users=% (preserved)',
    n_nodes, n_defs, n_users;
  if n_nodes <> 0 then
    raise exception 'reset failed: % node rows remain', n_nodes;
  end if;
end $$;

commit;

-- NOTE: any TEST user profiles in public.users are NOT touched here. Review
-- `select id, name, email, role, auth_id from public.users order by created_at;`
-- and delete obvious test accounts manually before importing.
