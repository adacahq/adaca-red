-- ─────────────────────────────────────────────────────────────
-- Enum choices gain key + label + tone (colour). Migrate existing definitions
-- whose enum `choices` are bare strings into the richer object form, baking in
-- the labels and the semantic tones that previously lived hardcoded in the
-- Chip component. Idempotent: choices already in object form are left as-is.
-- ─────────────────────────────────────────────────────────────

do $$
declare
  d            record;
  new_fields   jsonb;
  f            jsonb;
  new_choices  jsonb;
  c            jsonb;
  k            text;
begin
  for d in select id, config from public.definitions loop
    if jsonb_typeof(d.config->'fields') is distinct from 'array' then
      continue;
    end if;

    new_fields := '[]'::jsonb;

    for f in select * from jsonb_array_elements(d.config->'fields') loop
      if f->>'data_type' = 'enum' and jsonb_typeof(f->'options'->'choices') = 'array' then
        new_choices := '[]'::jsonb;

        for c in select * from jsonb_array_elements(f->'options'->'choices') loop
          if jsonb_typeof(c) = 'string' then
            k := c #>> '{}';
            new_choices := new_choices || jsonb_build_object(
              'key', k,
              'label', initcap(replace(k, '_', ' ')),
              'tone', case k
                when 'open' then 'crit'
                when 'active' then 'ok'
                when 'in_progress' then 'accent'
                when 'proposed' then 'info'
                when 'investigating' then 'warn'
                when 'mitigating' then 'warn'
                when 'identified' then 'warn'
                when 'monitoring' then 'warn'
                when 'blocked' then 'warn'
                when 'todo' then 'info'
                when 'cancelled' then 'neutral'
                when 'done' then 'ok'
                when 'resolved' then 'ok'
                when 'closed' then 'ok'
                when 'accepted' then 'info'
                when 'sev1' then 'crit'
                when 'sev2' then 'warn'
                when 'sev3' then 'info'
                when 'sev4' then 'neutral'
                when 'p0' then 'crit'
                when 'p1' then 'warn'
                when 'p2' then 'info'
                when 'p3' then 'neutral'
                else 'neutral'
              end
            );
          else
            new_choices := new_choices || c; -- already an object — leave it
          end if;
        end loop;

        f := jsonb_set(f, '{options,choices}', new_choices);
      end if;

      new_fields := new_fields || f;
    end loop;

    update public.definitions set config = jsonb_set(config, '{fields}', new_fields) where id = d.id;
  end loop;
end $$;
