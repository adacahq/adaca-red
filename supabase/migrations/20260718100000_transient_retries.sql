-- ─────────────────────────────────────────────────────────────
-- Transient LLM error retries — production incident 2026-07-17: a run
-- failed at `assess` with the Anthropic API returning a 529 overload
-- (`{"type":"error","error":{"type":"overloaded_error","message":
-- "Overloaded"},...}`). The SDK's own maxRetries: 1 (src/lib/llm/
-- anthropic.ts) doesn't survive a sustained overload window, and every such
-- error was previously treated by `advanceRun`'s catch block as a TERMINAL
-- run failure via `fail_run_unit` — one 529 killed the whole run even
-- though the underlying request was never actually broken, just busy.
--
-- This migration adds one new RPC, `release_run_unit`, that the runner
-- calls INSTEAD of `fail_run_unit` when the caught error is transient
-- (src/lib/workflows/runner.ts: `isTransientLlmError`). It releases the
-- claim so the SAME sub-unit is immediately re-claimable by the next
-- pumper, up to a cap (`p_max`); only once a sub-unit has been transiently
-- released `p_max` times does it fail the run for real, mirroring
-- `fail_run_unit`'s terminal shape (status/error/revision).
--
-- Same conventions as the sibling migrations (20260717090000/100000,
-- 20260718090000): security invoker (RLS still nominally applies, but
-- EXECUTE is restricted to service_role, which bypasses RLS), schema-
-- qualified, search_path cleared, no grants to public/anon/authenticated.
--
-- `advance_run_step` is also replaced (same signature/body as
-- 20260718090000) to additionally reset the new `run.retries` ledger to
-- `{}` at every step transition, alongside `done`/`claims` — retries are
-- per-CURRENT-step counters, same lifecycle as the claim ledger they sit
-- next to.
-- ─────────────────────────────────────────────────────────────

-- 1. release_run_unit(): token-checked like complete_run_unit/fail_run_unit
-- (claim must still belong to the caller). Behaviour branches on the
-- INCREMENTED per-sub retry count `c = coalesce(retries.<sub>, 0) + 1`:
--   c <  p_max: remove the claim, write retries.<sub> = c. Run stays
--               'running'; the sub-unit has no claim left, so the next
--               claim_run_unit call picks it up immediately (no need to
--               wait out the staleness TTL).
--   c >= p_max: terminal — remove the claim, write retries.<sub> = c,
--               run.status='failed', run.error = p_error, data.status=
--               'failed', bump current_rev and insert one revision with
--               p_change_note (exact mirror of fail_run_unit's terminal
--               write in 20260718090000).
-- Returns the new count c; NULL when no row matched (the claim was already
-- stolen by the time this pumper's call failed — same "stale claim, not an
-- error" swallow rationale as complete_run_unit/fail_run_unit).
--
-- Both branches auto-vivify `run.retries` to `{}` before writing the
-- sub-key, same as complete_run_unit's documented `jsonb_set` gotcha above
-- (20260718090000): every run already in flight or already failed BEFORE
-- this migration deploys has no `retries` key at all, and writing straight
-- to array['run','retries',p_sub::text] against such a row silently no-ops
-- (verified empirically against Postgres 17 while testing this migration —
-- the claim-removal half of the same UPDATE still "succeeds", which made
-- the missing counter invisible until traced through).
--
-- Implementation note: this is a read-increment-write on a value computed
-- FROM the row (the retry count), then branched on — expressing that as a
-- single UPDATE would need the SAME "count + 1" subexpression duplicated
-- across every SET target's CASE arm (retries write, and conditionally
-- status/error/data.status/current_rev), which is exactly the kind of
-- duplication this migration's authors decided was worse than the
-- alternative the brief explicitly sanctions: `SELECT ... FOR UPDATE`
-- inside this single plpgsql function call locks the row for the entire
-- read-modify-write. A Supabase RPC call is one top-level statement per
-- invocation (autocommit), so the function body runs as one transaction —
-- the FOR UPDATE lock is held from the SELECT through both possible UPDATEs
-- below, so a second concurrent release on the same sub-unit blocks until
-- this one commits, then reads the post-increment count. No lost updates.
create or replace function public.release_run_unit(
  p_id          text,
  p_step        int,
  p_sub         int,
  p_token       text,
  p_max         int,
  p_error       text,
  p_change_note text
)
returns int
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_author text;
  v_rev    int;
  v_data   jsonb;
  v_count  int;
begin
  select coalesce((data->'run'->'retries'->>p_sub::text)::int, 0) + 1
    into v_count
    from public.nodes
   where id = p_id
     and deleted_at is null
     and (data->'run'->>'stepIndex')::int = p_step
     and data->'run'->'claims'->(p_sub::text)->>'token' = p_token
     for update;

  if v_count is null then
    return null;
  end if;

  if v_count < p_max then
    -- Auto-vivify run.retries to {} first: jsonb_set only creates the LAST
    -- path element (see complete_run_unit's comment above, 20260718090000)
    -- — every run in flight or failed BEFORE this migration lacks the
    -- `retries` key entirely, so writing array['run','retries',p_sub::text]
    -- directly against those rows would silently no-op the counter (the
    -- claim-removal half of this same UPDATE would still "succeed", making
    -- the bug invisible without this fix).
    update public.nodes
       set data = jsonb_set(
             jsonb_set(data, '{run,retries}', coalesce(data->'run'->'retries', '{}'::jsonb)),
             array['run', 'retries', p_sub::text],
             to_jsonb(v_count)
           ) #- array['run', 'claims', p_sub::text]
     where id = p_id;

    return v_count;
  end if;

  select id into v_author from public.users where auth_id = (select auth.uid());

  update public.nodes
     set data = (
           jsonb_set(
             jsonb_set(
               jsonb_set(
                 jsonb_set(data, '{run,retries}', coalesce(data->'run'->'retries', '{}'::jsonb)),
                 array['run', 'retries', p_sub::text], to_jsonb(v_count)
               ),
               '{run,status}', '"failed"'
             ),
             '{run,error}',
             to_jsonb(p_error)
           ) #- array['run', 'claims', p_sub::text]
         ) || jsonb_build_object('status', 'failed'),
         current_rev = current_rev + 1
   where id = p_id
   returning current_rev, data into v_rev, v_data;

  insert into public.revisions (target_kind, target_id, rev_no, data, author_id, change_note)
  values ('node', p_id, v_rev, v_data, v_author, p_change_note);

  return v_count;
end;
$$;

revoke all on function public.release_run_unit(text, int, int, text, int, text, text) from public, anon, authenticated;
grant execute on function public.release_run_unit(text, int, int, text, int, text, text) to service_role;

-- 2. advance_run_step(): same signature/body as 20260718090000, plus a
-- `{run,retries}` reset to `{}` in both branches (alongside done/claims) —
-- copied verbatim otherwise, restating the revoke/grant lines.
create or replace function public.advance_run_step(
  p_id          text,
  p_from_step   int,
  p_total_subs  int,
  p_last_step   boolean,
  p_change_note text
)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_author text;
  v_rev    int;
  v_data   jsonb;
begin
  select id into v_author from public.users where auth_id = (select auth.uid());

  update public.nodes
     set data = (
           case when p_last_step then
             jsonb_set(
               jsonb_set(
                 jsonb_set(
                   jsonb_set(
                     jsonb_set(
                       jsonb_set(data, '{run,stepIndex}', to_jsonb(p_from_step + 1)),
                       '{run,done}', '{}'::jsonb
                     ),
                     '{run,claims}', '{}'::jsonb
                   ),
                   '{run,retries}', '{}'::jsonb
                 ),
                 '{run,status}', '"done"'
               ),
               '{run,finishedAt}',
               to_jsonb(to_char(now() at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'))
             ) || jsonb_build_object('status', 'assessed')
           else
             jsonb_set(
               jsonb_set(
                 jsonb_set(
                   jsonb_set(data, '{run,stepIndex}', to_jsonb(p_from_step + 1)),
                   '{run,done}', '{}'::jsonb
                 ),
                 '{run,claims}', '{}'::jsonb
               ),
               '{run,retries}', '{}'::jsonb
             )
           end
         ),
         current_rev = current_rev + 1
   where id = p_id
     and deleted_at is null
     and data->'run'->>'status' in ('pending', 'running')
     and (data->'run'->>'stepIndex')::int = p_from_step
     and (select count(*) from jsonb_object_keys(coalesce(data->'run'->'done', '{}'::jsonb))) >= p_total_subs
   returning current_rev, data into v_rev, v_data;

  if v_rev is null then
    return false;
  end if;

  insert into public.revisions (target_kind, target_id, rev_no, data, author_id, change_note)
  values ('node', p_id, v_rev, v_data, v_author, p_change_note);

  return true;
end;
$$;

revoke all on function public.advance_run_step(text, int, int, boolean, text) from public, anon, authenticated;
grant execute on function public.advance_run_step(text, int, int, boolean, text) to service_role;
