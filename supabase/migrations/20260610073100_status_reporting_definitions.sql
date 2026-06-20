-- ─────────────────────────────────────────────────────────────
-- Weekly status-reporting definitions.
--
-- Turns the spreadsheet/PowerPoint "Weekly Stakeholders Meeting" into the
-- typed graph: each PROJECT is an `initiative`; each weekly briefing is a
-- `status_report` child (mirrors the existing `incident_update` pattern —
-- a timestamped child node carrying narrative). KEY DATES become `milestone`
-- children; external blockers become `dependency` children.
--
-- ADDITIVE ONLY — no table DDL. New node TYPES via insert/upsert; the two
-- edited existing types (`initiative`, `task`) are full-config replacements
-- (same precedent as 20260607010108_risk_scale_labels), with enum choices in
-- the {key,label,tone} object form produced by 20260607010111. Re-runnable.
-- ─────────────────────────────────────────────────────────────

-- ── new node types ───────────────────────────────────────────
insert into public.definitions (kind, key, label, config) values

-- The weekly briefing snapshot. One per initiative per week; its sequence
-- over time IS the trend the spreadsheet tracked. Narrative blocks are
-- markdown (richtext), so the numbered "progress needed" lists store natively.
('node', 'status_report', 'Status report', '{
  "allowedParents": ["initiative"],
  "fields": [
    {"key":"weekOf","label":"Week of","data_type":"date","required":true,"filterable":true,"position":0},
    {"key":"health","label":"Overall status","data_type":"enum","required":true,"filterable":true,"position":1,
      "options":{"choices":[
        {"key":"not_started","label":"Not started","tone":"neutral"},
        {"key":"on_track","label":"On track","tone":"ok"},
        {"key":"at_risk","label":"At risk","tone":"warn"},
        {"key":"off_track","label":"Off track","tone":"crit"},
        {"key":"on_hold","label":"On hold","tone":"info"}]}},
    {"key":"percentComplete","label":"% complete","data_type":"number","filterable":true,"position":2,
      "options":{"min":0,"max":100}},
    {"key":"plannedPercent","label":"Planned %","data_type":"number","position":3,
      "options":{"min":0,"max":100}},
    {"key":"budgetUsed","label":"Budget used","data_type":"number","position":4},
    {"key":"headline","label":"This week''s headline","data_type":"richtext","position":5},
    {"key":"progressNeeded","label":"Progress needed","data_type":"richtext","position":6},
    {"key":"focusNextWeek","label":"Focus next week","data_type":"richtext","position":7},
    {"key":"parkedQuestions","label":"Parked questions / help needed","data_type":"richtext","position":8}
  ]
}'::jsonb),

-- KEY DATES / the milestones table: planned vs forecast, with a RAG status.
('node', 'milestone', 'Milestone', '{
  "allowedParents": ["initiative"],
  "fields": [
    {"key":"title","label":"Title","data_type":"text","required":true,"filterable":true,"position":0},
    {"key":"plannedDate","label":"Planned date","data_type":"date","filterable":true,"position":1},
    {"key":"forecastDate","label":"Forecast date","data_type":"date","position":2},
    {"key":"status","label":"Status","data_type":"enum","filterable":true,"position":3,
      "options":{"choices":[
        {"key":"not_started","label":"Not started","tone":"neutral"},
        {"key":"on_track","label":"On track","tone":"ok"},
        {"key":"at_risk","label":"At risk","tone":"warn"},
        {"key":"complete","label":"Complete","tone":"accent"}]}}
  ]
}'::jsonb),

-- External dependencies: what we are waiting on, from whom, by when.
('node', 'dependency', 'Dependency', '{
  "allowedParents": ["initiative"],
  "fields": [
    {"key":"title","label":"Description","data_type":"text","required":true,"filterable":true,"position":0},
    {"key":"source","label":"From (team/org)","data_type":"text","filterable":true,"position":1},
    {"key":"neededBy","label":"Needed by","data_type":"date","filterable":true,"position":2},
    {"key":"status","label":"Status","data_type":"enum","filterable":true,"position":3,
      "options":{"choices":[
        {"key":"on_track","label":"On track","tone":"ok"},
        {"key":"at_risk","label":"At risk","tone":"warn"},
        {"key":"blocked","label":"Blocked","tone":"crit"}]}}
  ]
}'::jsonb)

on conflict (key) do update set label = excluded.label, config = excluded.config;

-- ── edit: initiative gains phase / health / %-complete / budget ──
-- Full-config replace (preserves status/priority choice tones from 20260607010111).
-- `health` is the weekly RAG axis, ORTHOGONAL to the lifecycle `status`; it is
-- the at-a-glance mirror of the latest status_report (written back on save).
update public.definitions
set config = '{
  "allowedParents": [],
  "fields": [
    {"key":"title","label":"Title","data_type":"text","required":true,"filterable":true,"position":0},
    {"key":"status","label":"Status","data_type":"enum","required":true,"filterable":true,"position":1,
      "options":{"choices":[
        {"key":"proposed","label":"Proposed","tone":"info"},
        {"key":"active","label":"Active","tone":"ok"},
        {"key":"blocked","label":"Blocked","tone":"warn"},
        {"key":"done","label":"Done","tone":"ok"},
        {"key":"cancelled","label":"Cancelled","tone":"neutral"}]}},
    {"key":"health","label":"Overall status","data_type":"enum","required":true,"filterable":true,"position":2,
      "options":{"choices":[
        {"key":"not_started","label":"Not started","tone":"neutral"},
        {"key":"on_track","label":"On track","tone":"ok"},
        {"key":"at_risk","label":"At risk","tone":"warn"},
        {"key":"off_track","label":"Off track","tone":"crit"},
        {"key":"on_hold","label":"On hold","tone":"info"}]}},
    {"key":"priority","label":"Priority","data_type":"enum","filterable":true,"position":3,
      "options":{"choices":[
        {"key":"p0","label":"P0","tone":"crit"},
        {"key":"p1","label":"P1","tone":"warn"},
        {"key":"p2","label":"P2","tone":"info"},
        {"key":"p3","label":"P3","tone":"neutral"}]}},
    {"key":"phase","label":"Phase","data_type":"number","filterable":true,"position":4,
      "options":{"min":0}},
    {"key":"percentComplete","label":"% complete","data_type":"number","filterable":true,"position":5,
      "options":{"min":0,"max":100}},
    {"key":"budgetTotal","label":"Budget (total)","data_type":"number","position":6},
    {"key":"summary","label":"Summary","data_type":"richtext","position":7},
    {"key":"targetDate","label":"Target date","data_type":"date","filterable":true,"position":8}
  ]
}'::jsonb
where key = 'initiative';

-- ── edit: task gains Comments, and status uses the team vocabulary ──
-- Keys are UNCHANGED (todo/in_progress/blocked/done); only labels move to
-- Planned/Ongoing to match the Action Log. richtext `notes` = the Comments col.
update public.definitions
set config = '{
  "allowedParents": ["initiative","group","task","incident"],
  "fields": [
    {"key":"title","label":"Title","data_type":"text","required":true,"filterable":true,"position":0},
    {"key":"status","label":"Status","data_type":"enum","required":true,"filterable":true,"position":1,
      "options":{"choices":[
        {"key":"todo","label":"Planned","tone":"info"},
        {"key":"in_progress","label":"Ongoing","tone":"accent"},
        {"key":"blocked","label":"Blocked","tone":"warn"},
        {"key":"done","label":"Done","tone":"ok"}]}},
    {"key":"dueDate","label":"Due date","data_type":"date","filterable":true,"position":2},
    {"key":"notes","label":"Comments","data_type":"richtext","position":3}
  ]
}'::jsonb
where key = 'task';
