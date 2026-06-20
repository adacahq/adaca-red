-- ─────────────────────────────────────────────────────────────
-- Edge model: replace the `from[] / to[]` lists with explicit (from→to) pairs.
--
-- The old shape implied the CROSS-PRODUCT of from×to, silently authorising
-- relationships nobody declared (from:[task,risk] × to:[group,initiative] also
-- allowed task→initiative). Pairs make each distinct relationship explicit.
--
-- This converts every existing edge definition to the cross-product of its
-- current from×to — i.e. preserves today's behaviour exactly — then drops the
-- old keys. The four seeded edges each have single-element lists, so they become
-- a single clean pair; `related` becomes `{from:'*', to:'*'}`. The new editor
-- lets admins prune unwanted pairs afterwards. Idempotent: once `from`/`to` are
-- gone the WHERE no longer matches.
-- ─────────────────────────────────────────────────────────────

update public.definitions d
set config = (d.config - 'from' - 'to') || jsonb_build_object('pairs', (
  select coalesce(
    jsonb_agg(jsonb_build_object('from', f.val, 'to', t.val)),
    '[]'::jsonb
  )
  from jsonb_array_elements_text(coalesce(d.config -> 'from', '[]'::jsonb)) as f(val),
       jsonb_array_elements_text(coalesce(d.config -> 'to', '[]'::jsonb)) as t(val)
))
where d.kind = 'edge'
  and (d.config ? 'from' or d.config ? 'to');
