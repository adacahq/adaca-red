-- ─────────────────────────────────────────────────────────────
-- Parallel unit execution — the engine's sanctioned direct writes to
-- nodes.data.run.
--
-- Per-principle assess calls and per-section report calls are independent
-- and now execute CONCURRENTLY (multiple pumpers can claim different
-- sub-units of the same step at once). Whole-data save_node persists cannot
-- coexist with concurrent writers: two units finishing around the same time
-- would last-writer-wins clobber each other's output (exactly the bug this
-- migration replaces). These four functions are atomic PER-SLOT mutations —
-- claim / complete / advance-step / fail — each touching only the exact
-- jsonb path its caller owns, so siblings never step on each other. Same
-- rationale and conventions as claim_run_unit (20260717090000 /
-- 20260717100000): security invoker (RLS still nominally applies, but
-- EXECUTE is restricted to service_role, which bypasses RLS), schema-
-- qualified, search_path cleared, no grants to public/anon/authenticated.
--
-- Steps stay a sequential barrier (advance_run_step only fires once every
-- sub-unit of the CURRENT step is done); only sub-units WITHIN a step run
-- concurrently. `done`/`claims` are keyed by stringified sub-index and are
-- reset to {} at every step transition — they describe the CURRENT step
-- only, replacing the old single (stepIndex, subIndex) cursor.
-- ─────────────────────────────────────────────────────────────

-- 1. claim_run_unit(): SAME signature as 20260717100000, new ledger-based
-- body. A sub-unit is claimable when the run is pending/running, sitting at
-- the caller's stepIndex, not already marked done, and its own claim (if
-- any) is absent or stale (>10 min — see 20260717100000's TTL rationale).
-- Folds in the state transitions that used to happen in TS before persist():
-- run.status -> 'running', and data.status 'received' -> 'processing' on
-- the very first claim of a run.
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
           jsonb_set(
             data,
             array['run', 'claims', p_sub::text],
             jsonb_build_object('token', v_token, 'at', now())
           ),
           '{run,status}',
           '"running"'
         ) || (
           case when data->>'status' = 'received'
             then jsonb_build_object('status', 'processing')
             else '{}'::jsonb
           end
         )
   where id = p_id
     and deleted_at is null
     and data->'run'->>'status' in ('pending', 'running')
     and (data->'run'->>'stepIndex')::int = p_step
     and data->'run'->'done'->(p_sub::text) is null
     and (
       (data->'run'->'claims'->(p_sub::text)->>'at') is null
       or (data->'run'->'claims'->(p_sub::text)->>'at')::timestamptz < now() - interval '10 minutes'
     )
   returning data->'run'->'claims'->(p_sub::text)->>'token' into v_claimed;

  return v_claimed;
end;
$$;

revoke all on function public.claim_run_unit(text, int, int) from public, anon, authenticated;
grant execute on function public.claim_run_unit(text, int, int) to service_role;

-- 2. complete_run_unit(): writes a unit's output atomically at its own slot
-- (a path under `data`, e.g. {run,steps,assess,findings}), marks the
-- sub-index done, and clears its own claim — all in one UPDATE. Rejects a
-- stolen claim (token mismatch, e.g. this pumper's claim expired mid-call
-- and someone else re-claimed the same sub-unit) by matching no row and
-- returning NULL; the caller discards the work rather than risk overwriting
-- a fresher attempt.
--
-- jsonb_set only auto-creates the LAST element of a path — every earlier
-- segment must already exist, or the write silently no-ops (verified
-- against Postgres 17: there is no error, the row is just unchanged).
-- run.steps starts as {} (initialRunState) so 3-deep slots (e.g.
-- {run,steps,extract}) are always safe, but assess's slot is 4 deep
-- ({run,steps,assess,findings} — findings must merge at the CONTROL-key
-- level, one below the principle, for concurrent principle writes to be
-- non-clobbering) and run.steps.assess itself is never pre-seeded. So this
-- function auto-vivifies the slot's immediate parent (coalesce to {} if
-- missing) before the real write — a no-op where the parent already exists
-- (run.steps, or run.steps.assess from the 2nd+ principle onward),
-- load-bearing on assess's first-ever completion.
create or replace function public.complete_run_unit(
  p_id     text,
  p_step   int,
  p_sub    int,
  p_token  text,
  p_slot   text[],
  p_output jsonb,
  p_merge  boolean
)
returns int
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_parent text[] := p_slot[1:array_length(p_slot, 1) - 1];
  v_data   jsonb;
begin
  update public.nodes
     set data = jsonb_set(
           jsonb_set(
             jsonb_set(
               data,
               v_parent,
               coalesce(data #> v_parent, '{}'::jsonb)
             ),
             p_slot,
             case when p_merge then coalesce(data #> p_slot, '{}'::jsonb) || p_output else p_output end
           ),
           array['run', 'done', p_sub::text],
           'true'::jsonb
         ) #- array['run', 'claims', p_sub::text]
   where id = p_id
     and deleted_at is null
     and (data->'run'->>'stepIndex')::int = p_step
     and data->'run'->'claims'->(p_sub::text)->>'token' = p_token
   returning data into v_data;

  if v_data is null then
    return null;
  end if;

  return (select count(*) from jsonb_object_keys(v_data->'run'->'done'))::int;
end;
$$;

revoke all on function public.complete_run_unit(text, int, int, text, text[], jsonb, boolean) from public, anon, authenticated;
grant execute on function public.complete_run_unit(text, int, int, text, text[], jsonb, boolean) to service_role;

-- 3. advance_run_step(): fires once every sub-unit of the current step is
-- done (guarded by the WHERE re-counting run.done itself, so two pumpers
-- racing to be "the one that advances" both pass harmlessly — the loser
-- finds stepIndex already moved and matches zero rows). Resets done/claims
-- to {} for the new step and, mirroring save_node, snapshots ONE revision
-- per step transition (not per unit) — keeps the debugging timeline
-- readable without spamming the append-only log.
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
                     jsonb_set(data, '{run,stepIndex}', to_jsonb(p_from_step + 1)),
                     '{run,done}', '{}'::jsonb
                   ),
                   '{run,claims}', '{}'::jsonb
                 ),
                 '{run,status}', '"done"'
               ),
               '{run,finishedAt}',
               to_jsonb(to_char(now() at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'))
             ) || jsonb_build_object('status', 'assessed')
           else
             jsonb_set(
               jsonb_set(
                 jsonb_set(data, '{run,stepIndex}', to_jsonb(p_from_step + 1)),
                 '{run,done}', '{}'::jsonb
               ),
               '{run,claims}', '{}'::jsonb
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

-- 4. fail_run_unit(): terminal failure for the whole run, triggered by
-- whichever unit throws. Same token-match gate as complete_run_unit (a
-- stolen claim means someone else owns the run now — this pumper's failure
-- is stale and must not clobber their work), then one revision, mirroring
-- save_node/advance_run_step.
create or replace function public.fail_run_unit(
  p_id          text,
  p_step        int,
  p_sub         int,
  p_token       text,
  p_error       text,
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
           jsonb_set(
             jsonb_set(data, '{run,status}', '"failed"'),
             '{run,error}',
             to_jsonb(p_error)
           ) #- array['run', 'claims', p_sub::text]
         ) || jsonb_build_object('status', 'failed'),
         current_rev = current_rev + 1
   where id = p_id
     and deleted_at is null
     and (data->'run'->>'stepIndex')::int = p_step
     and data->'run'->'claims'->(p_sub::text)->>'token' = p_token
   returning current_rev, data into v_rev, v_data;

  if v_rev is null then
    return false;
  end if;

  insert into public.revisions (target_kind, target_id, rev_no, data, author_id, change_note)
  values ('node', p_id, v_rev, v_data, v_author, p_change_note);

  return true;
end;
$$;

revoke all on function public.fail_run_unit(text, int, int, text, text, text) from public, anon, authenticated;
grant execute on function public.fail_run_unit(text, int, int, text, text, text) to service_role;
