-- ─────────────────────────────────────────────────────────────
-- Seed: roles + node/edge definitions.
--
-- This is REFERENCE data that ships to every environment (hence a migration,
-- not supabase/seed.sql which only runs on local `db reset`). Each definition
-- carries its field structure in `config.fields` — the single source the app
-- uses to generate forms, filters and Zod validation. Re-runnable via upsert
-- on `key`.
-- ─────────────────────────────────────────────────────────────

-- ── roles ────────────────────────────────────────────────────
insert into public.roles (key, label, config) values
  ('owner',    'Owner',    '{"singular": true}'::jsonb),
  ('assignee', 'Assignee', '{"singular": false}'::jsonb),
  ('reviewer', 'Reviewer', '{"singular": false}'::jsonb)
on conflict (key) do update set label = excluded.label, config = excluded.config;

-- ── node definitions ─────────────────────────────────────────
insert into public.definitions (kind, key, label, config) values

('node', 'initiative', 'Initiative', '{
  "allowedParents": [],
  "fields": [
    {"key":"title","label":"Title","data_type":"text","required":true,"filterable":true,"position":0},
    {"key":"status","label":"Status","data_type":"enum","required":true,"filterable":true,"position":1,
      "options":{"choices":["proposed","active","blocked","done","cancelled"]}},
    {"key":"priority","label":"Priority","data_type":"enum","filterable":true,"position":2,
      "options":{"choices":["p0","p1","p2","p3"]}},
    {"key":"summary","label":"Summary","data_type":"richtext","position":3},
    {"key":"targetDate","label":"Target date","data_type":"date","filterable":true,"position":4}
  ]
}'::jsonb),

('node', 'group', 'Group', '{
  "allowedParents": ["initiative","group"],
  "fields": [
    {"key":"title","label":"Title","data_type":"text","required":true,"filterable":true,"position":0},
    {"key":"status","label":"Status","data_type":"enum","filterable":true,"position":1,
      "options":{"choices":["open","done"]}}
  ]
}'::jsonb),

('node', 'task', 'Task', '{
  "allowedParents": ["initiative","group","task","incident"],
  "fields": [
    {"key":"title","label":"Title","data_type":"text","required":true,"filterable":true,"position":0},
    {"key":"status","label":"Status","data_type":"enum","required":true,"filterable":true,"position":1,
      "options":{"choices":["todo","in_progress","blocked","done"]}},
    {"key":"dueDate","label":"Due date","data_type":"date","filterable":true,"position":2}
  ]
}'::jsonb),

('node', 'risk_group', 'Risk group', '{
  "allowedParents": [],
  "fields": [
    {"key":"title","label":"Title","data_type":"text","required":true,"filterable":true,"position":0}
  ]
}'::jsonb),

('node', 'risk', 'Risk', '{
  "allowedParents": ["risk_group"],
  "fields": [
    {"key":"title","label":"Title","data_type":"text","required":true,"filterable":true,"position":0},
    {"key":"status","label":"Status","data_type":"enum","required":true,"filterable":true,"position":1,
      "options":{"choices":["open","mitigating","accepted","closed"]}},
    {"key":"likelihood","label":"Likelihood","data_type":"number","filterable":true,"position":2,
      "options":{"min":1,"max":5}},
    {"key":"impact","label":"Impact","data_type":"number","filterable":true,"position":3,
      "options":{"min":1,"max":5}},
    {"key":"category","label":"Category","data_type":"text","filterable":true,"position":4},
    {"key":"summary","label":"Summary","data_type":"richtext","position":5}
  ]
}'::jsonb),

-- Incident is shaped as a full OPERATIONAL INCIDENT REPORT. The chronology
-- lives in child `incident_update` nodes; action items live in child `task`
-- nodes. richtext fields are stored as markdown (see decision #5).
('node', 'incident', 'Incident', '{
  "allowedParents": [],
  "fields": [
    {"key":"title","label":"Title","data_type":"text","required":true,"filterable":true,"position":0},
    {"key":"status","label":"Status","data_type":"enum","required":true,"filterable":true,"position":1,
      "options":{"choices":["open","investigating","identified","monitoring","resolved","closed"]}},
    {"key":"severity","label":"Severity","data_type":"enum","required":true,"filterable":true,"position":2,
      "options":{"choices":["sev1","sev2","sev3","sev4"]}},
    {"key":"occurredAt","label":"Occurred at","data_type":"date","filterable":true,"position":3},
    {"key":"detectedAt","label":"Detected at","data_type":"date","position":4},
    {"key":"resolvedAt","label":"Resolved at","data_type":"date","filterable":true,"position":5},
    {"key":"detection","label":"How detected","data_type":"text","position":6},
    {"key":"impact","label":"Impact","data_type":"richtext","position":7},
    {"key":"summary","label":"What happened","data_type":"richtext","position":8},
    {"key":"rootCause","label":"Root cause","data_type":"richtext","position":9},
    {"key":"resolution","label":"Resolution","data_type":"richtext","position":10}
  ]
}'::jsonb),

-- Timeline entry for an incident report (the running chronology).
('node', 'incident_update', 'Incident update', '{
  "allowedParents": ["incident"],
  "fields": [
    {"key":"at","label":"Time","data_type":"date","required":true,"filterable":true,"position":0},
    {"key":"note","label":"Update","data_type":"richtext","required":true,"position":1}
  ]
}'::jsonb)

on conflict (key) do update set label = excluded.label, config = excluded.config;

-- ── edge definitions ─────────────────────────────────────────
insert into public.definitions (kind, key, label, config) values

-- RED: the one scored relationship. Initiative —[R·E·D]→ Risk.
('edge', 'mitigates', 'Mitigates', '{
  "from": ["initiative"],
  "to": ["risk"],
  "fields": [
    {"key":"relevance","label":"Relevance","data_type":"number","required":true,"filterable":true,"position":0,
      "options":{"min":0,"max":4}},
    {"key":"extent","label":"Extent","data_type":"number","required":true,"filterable":true,"position":1,
      "options":{"min":0,"max":4}},
    {"key":"duration","label":"Duration","data_type":"number","required":true,"filterable":true,"position":2,
      "options":{"min":0,"max":4}},
    {"key":"assessmentDate","label":"Assessment date","data_type":"date","filterable":true,"position":3}
  ]
}'::jsonb),

-- Incident realises Risk (plain link).
('edge', 'realises', 'Realises', '{"from":["incident"],"to":["risk"],"fields":[]}'::jsonb),

-- Initiative remediates Incident (plain link).
('edge', 'remediates', 'Remediates', '{"from":["initiative"],"to":["incident"],"fields":[]}'::jsonb),

-- Loose association between any two nodes (plain link).
('edge', 'related', 'Related', '{"from":["*"],"to":["*"],"fields":[]}'::jsonb)

on conflict (key) do update set label = excluded.label, config = excluded.config;
