-- ─────────────────────────────────────────────────────────────
-- Seed detail-screen tab specs onto the original node definitions.
--
-- Tabs are otherwise DERIVED (Overview + one per child type + one per edge
-- relation + Activity). This overlay preserves the hand-built layouts the three
-- domain types shipped with — ordering, the combined Tasks tree, and the
-- optional Board/RED/Timeline views (added because their circumstance holds) —
-- expressed as data on `config.tabs`.
--
-- `config || '{...}'` merges the `tabs` key in, leaving `fields`/`allowedParents`
-- untouched. Idempotent / re-runnable. A brand-new node type gets no overlay and
-- falls back to the derived defaults.
-- ─────────────────────────────────────────────────────────────

-- Initiative: Overview · Board · Tasks (group+task tree) · Incidents addressed ·
-- Risks (RED) · Activity. The per-type Groups tab and the generic mitigates edge
-- tab are hidden in favour of the combined Tasks tree and the RED view.
update public.definitions set config = config || '{
  "sidebar": true,
  "icon": "rocket",
  "tabs": [
    {"id":"overview","ref":"overview"},
    {"id":"board","kind":"board","label":"Board","config":{"childType":"task","groupBy":"status","containerTypes":["group"]}},
    {"id":"tasks","ref":"child:task","label":"Tasks","config":{"onlyTypes":["group","task"]}},
    {"id":"group","ref":"child:group","hidden":true},
    {"id":"incidents","ref":"edge:remediates:from:incident","label":"Incidents addressed"},
    {"id":"risks","kind":"red","label":"Risks (RED)"},
    {"id":"mitigates","ref":"edge:mitigates:from:risk","hidden":true},
    {"id":"activity","ref":"activity"}
  ]
}'::jsonb where key = 'initiative';

-- Risk: Overview · Mitigations (RED) · Realised by incidents · Activity.
update public.definitions set config = config || '{
  "sidebar": true,
  "icon": "shield",
  "tabs": [
    {"id":"overview","ref":"overview"},
    {"id":"mitigations","kind":"red","label":"Mitigations"},
    {"id":"realised","ref":"edge:realises:to:incident","label":"Realised by incidents"},
    {"id":"mitigates","ref":"edge:mitigates:to:initiative","hidden":true},
    {"id":"activity","ref":"activity"}
  ]
}'::jsonb where key = 'risk';

-- Incident: Overview · Timeline · Action items (task tree) · Realises (risks) ·
-- Remediated by initiatives · Activity. The incident_update child tab is hidden
-- (the Timeline view renders those chronologically).
update public.definitions set config = config || '{
  "sidebar": true,
  "icon": "fire",
  "tabs": [
    {"id":"overview","ref":"overview"},
    {"id":"timeline","kind":"timeline","label":"Timeline"},
    {"id":"actions","ref":"child:task","label":"Action items"},
    {"id":"updates","ref":"child:incident_update","hidden":true},
    {"id":"realises","ref":"edge:realises:from:risk","label":"Realises (risks)"},
    {"id":"remediated","ref":"edge:remediates:to:initiative","label":"Remediated by initiatives"},
    {"id":"activity","ref":"activity"}
  ]
}'::jsonb where key = 'incident';
