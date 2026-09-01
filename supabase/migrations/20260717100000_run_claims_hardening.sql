-- ─────────────────────────────────────────────────────────────
-- claim_run_unit(): hardening pass over the 20260717090000 version.
--
-- Two changes, same signature/conventions (security invoker, schema-
-- qualified, search_path clear, same revoke/grant):
--
--  1. Null-safe staleness check. The old check was
--     `data->'run'->'claim' is null or (...)->>'at' < now() - interval`.
--     `->'claim'` is only SQL NULL when the KEY is absent — a JSON `null`
--     (`claim: null`, which a full `persist()` can legitimately write) is a
--     non-null jsonb value, so `is null` was false and the second branch's
--     `->>'at'` on a json-null produced SQL NULL, which is never `<` anything
--     — a run in that state became permanently unclaimable. Reading `->>'at'`
--     directly collapses all three "no usable claim" cases (absent key,
--     JSON-null claim, claim object missing `at`) to SQL NULL in one
--     condition, so `is null` alone covers them.
--  2. TTL 5 -> 10 minutes, so it stays above the LLM client's worst-case
--     per-unit budget (Anthropic client: 2 attempts x 3 min timeout, see
--     src/lib/llm/anthropic.ts) — a live pumper's claim must outlast its own
--     call. Also matches the cron sweep's >10-min stalled threshold
--     (STALLED_AFTER_MS in src/lib/purge/run.ts).
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
       (data->'run'->'claim'->>'at') is null
       or (data->'run'->'claim'->>'at')::timestamptz < now() - interval '10 minutes'
     )
   returning data->'run'->'claim'->>'token' into v_claimed;

  return v_claimed;
end;
$$;

revoke all on function public.claim_run_unit(text, int, int) from public, anon, authenticated;
grant execute on function public.claim_run_unit(text, int, int) to service_role;
