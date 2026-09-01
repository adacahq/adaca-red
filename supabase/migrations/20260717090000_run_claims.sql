-- ─────────────────────────────────────────────────────────────
-- claim_run_unit(): atomic per-unit concurrency gate for advanceRun.
--
-- Multiple pumpers can call advanceRun() for the same submission
-- concurrently (the public status-page poll loop, a second browser tab, the
-- hourly purge-cron sweep, admin retry) — without a gate, two of them load
-- the same run, execute the SAME unit, and persist last-writer-wins (double
-- LLM call, double assessment node, double email). This function is the
-- ONE thing standing between that and correct single-execution.
--
-- It is a SANCTIONED DIRECT WRITE to nodes.data that deliberately bypasses
-- save_node/revisions: a claim is an ephemeral scheduling marker, not domain
-- history — writing a revision per claim would spam the append-only log for
-- something with no audit value. `advanceRun` calls this before executing a
-- unit and backs off (treats it as "another pumper owns this unit") when it
-- returns null.
--
-- Match requires: the run is still pending/running, still sitting at the
-- exact (stepIndex, subIndex) the caller is about to execute, and the
-- existing claim (if any) is either absent or stale (> 5 min old — a crashed
-- pumper's claim self-expires so the run isn't stuck forever).
-- ─────────────────────────────────────────────────────────────

create or replace function public.claim_run_unit(p_id text, p_step int, p_sub int)
returns text
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_token   text := gen_random_uuid()::text;
  v_claimed text;
begin
  update public.nodes
     set data = jsonb_set(
           data,
           '{run,claim}',
           jsonb_build_object('token', v_token, 'at', now())
         )
   where id = p_id
     and deleted_at is null
     and data->'run'->>'status' in ('pending', 'running')
     and (data->'run'->>'stepIndex')::int = p_step
     and (data->'run'->>'subIndex')::int = p_sub
     and (
       data->'run'->'claim' is null
       or (data->'run'->'claim'->>'at')::timestamptz < now() - interval '5 minutes'
     )
   returning data->'run'->'claim'->>'token' into v_claimed;

  return v_claimed;
end;
$$;

revoke all on function public.claim_run_unit(text, int, int) from public, anon, authenticated;
grant execute on function public.claim_run_unit(text, int, int) to service_role;
