-- ─────────────────────────────────────────────────────────────
-- Seed: submission/assessment node types + the StratAlliance
-- "AI Deployer Baseline Diagnostic" form / rubric / workflow.
--
-- ADDITIVE ONLY — no table DDL. The rubric here is a REPRESENTATIVE seed of
-- the Responsible AI Standard (6 principles, a few controls each); the full
-- ~42-control standard is entered/maintained by StratAlliance via
-- Admin → Rubrics. Re-runnable (upserts by key).
-- ─────────────────────────────────────────────────────────────

-- ── node types ───────────────────────────────────────────────
insert into public.definitions (kind, key, label, config) values

-- A public form submission. Short-lived (retention.submission clock): the
-- uploaded documents attach via `documents`; the workflow's run state lives
-- in data.run (undeclared — structural, not a form field).
('node', 'submission', 'Submission', '{
  "allowedParents": [],
  "sidebar": true,
  "fields": [
    {"key":"title","label":"Title","data_type":"text","required":true,"filterable":true,"position":0},
    {"key":"status","label":"Status","data_type":"enum","filterable":true,"position":1,
      "options":{"choices":[
        {"key":"received","label":"Received","tone":"info"},
        {"key":"processing","label":"Processing","tone":"warn"},
        {"key":"assessed","label":"Assessed","tone":"ok"},
        {"key":"failed","label":"Failed","tone":"crit"}]}},
    {"key":"form_key","label":"Form","data_type":"text","filterable":true,"position":2},
    {"key":"contact_name","label":"Contact name","data_type":"text","position":3},
    {"key":"contact_email","label":"Contact email","data_type":"text","required":true,"position":4},
    {"key":"organisation","label":"Organisation","data_type":"text","filterable":true,"position":5},
    {"key":"consent","label":"Consent to contact","data_type":"boolean","position":6},
    {"key":"document_names","label":"Documents","data_type":"text","position":7}
  ]
}'::jsonb),

-- The workflow''s durable output. Long-lived (retention.assessment clock);
-- self-contained by construction — denormalised context + carried-over
-- contact fields + findings/report in data (structured by the rubric).
('node', 'assessment', 'Assessment', '{
  "allowedParents": [],
  "sidebar": true,
  "fields": [
    {"key":"title","label":"Title","data_type":"text","required":true,"filterable":true,"position":0},
    {"key":"status","label":"Status","data_type":"enum","filterable":true,"position":1,
      "options":{"choices":[
        {"key":"draft","label":"Draft","tone":"neutral"},
        {"key":"issued","label":"Issued","tone":"ok"}]}},
    {"key":"verdict","label":"Verdict","data_type":"enum","filterable":true,"position":2,
      "options":{"choices":[
        {"key":"green","label":"Green","tone":"ok"},
        {"key":"amber","label":"Amber","tone":"warn"},
        {"key":"red","label":"Red","tone":"crit"}]}},
    {"key":"form_key","label":"Form","data_type":"text","filterable":true,"position":3},
    {"key":"submission_id","label":"Submission","data_type":"text","position":4},
    {"key":"submitted_at","label":"Submitted","data_type":"date","filterable":true,"position":5},
    {"key":"organisation","label":"Organisation","data_type":"text","filterable":true,"position":6},
    {"key":"contact_name","label":"Contact name","data_type":"text","position":7},
    {"key":"contact_email","label":"Contact email","data_type":"text","position":8},
    {"key":"document_names","label":"Documents","data_type":"text","position":9}
  ]
}'::jsonb)

on conflict (key) do update set label = excluded.label, config = excluded.config;

-- ── rubric: Responsible AI Standard (seed subset) ────────────
insert into public.definitions (kind, key, label, config) values
('rubric', 'rai_standard', 'Responsible AI Standard', '{
  "ratings": [
    {"key":"covered","label":"Covered","score":2,"tone":"ok"},
    {"key":"partial","label":"Partially covered","score":1,"tone":"warn"},
    {"key":"not_covered","label":"Not covered","score":0,"tone":"crit"},
    {"key":"not_applicable","label":"Not applicable","score":null,"tone":"neutral"}
  ],
  "principles": [
    {"key":"FA","label":"Fairness","description":"AI systems treat people equitably and avoid unjust discrimination.","controls":[
      {"key":"FA-01","label":"Fairness policy","description":"A documented policy commits the organisation to fair and non-discriminatory AI outcomes.","evidence":"A policy or standard that names fairness/non-discrimination as a requirement for AI systems."},
      {"key":"FA-02","label":"Bias assessment","description":"AI use cases are assessed for bias risk before deployment.","evidence":"A bias/discrimination assessment step in the AI approval or review process."},
      {"key":"FA-03","label":"Affected-group identification","description":"Groups who could be adversely affected by an AI system are identified and considered.","evidence":"Impact analysis naming affected cohorts or protected attributes."}
    ]},
    {"key":"RS","label":"Reliability & Safety","description":"AI systems perform reliably, safely and as intended.","controls":[
      {"key":"RS-01","label":"Testing before deployment","description":"AI systems are tested against defined acceptance criteria before production use.","evidence":"Test plans, acceptance criteria, or UAT records for AI systems."},
      {"key":"RS-02","label":"Ongoing monitoring","description":"Deployed AI systems are monitored for performance degradation and drift.","evidence":"Monitoring procedures, review cadences, or alerting for AI behaviour in production."},
      {"key":"RS-03","label":"Failure handling","description":"There is a defined response when an AI system fails or behaves unexpectedly.","evidence":"Incident/rollback procedures that explicitly cover AI systems."}
    ]},
    {"key":"DP","label":"Data Protection & Privacy","description":"Personal and sensitive data used by AI is protected and lawfully handled.","controls":[
      {"key":"DP-01","label":"Data classification","description":"Data used to train or prompt AI systems is classified and handled per its sensitivity.","evidence":"A data classification scheme applied to AI inputs/training data."},
      {"key":"DP-02","label":"Privacy compliance","description":"AI data handling complies with applicable privacy law and internal privacy policy.","evidence":"Privacy impact assessments or policy clauses covering AI processing of personal information."},
      {"key":"DP-03","label":"Data minimisation","description":"AI systems use only the data necessary for their purpose.","evidence":"Guidance restricting what data may be sent to or used by AI systems."}
    ]},
    {"key":"IN","label":"Inclusiveness","description":"AI systems are accessible and consider the full range of users.","controls":[
      {"key":"IN-01","label":"Accessibility","description":"AI-powered services meet accessibility expectations.","evidence":"Accessibility requirements applied to AI-facing services."},
      {"key":"IN-02","label":"Stakeholder consultation","description":"Affected stakeholders are consulted in AI design or deployment decisions.","evidence":"Consultation or feedback steps in the AI lifecycle."}
    ]},
    {"key":"TR","label":"Transparency","description":"People understand when and how AI is being used.","controls":[
      {"key":"TR-01","label":"AI use disclosure","description":"People are told when they are interacting with or subject to AI decisions.","evidence":"Disclosure/notification requirements for AI interactions."},
      {"key":"TR-02","label":"Explainability","description":"Material AI decisions can be explained to those affected.","evidence":"Explainability requirements or model documentation standards."},
      {"key":"TR-03","label":"AI inventory","description":"The organisation maintains a register of its AI systems and uses.","evidence":"An AI system inventory/register with ownership."}
    ]},
    {"key":"AC","label":"Accountability","description":"Humans remain accountable for AI systems and their outcomes.","controls":[
      {"key":"AC-01","label":"Named ownership","description":"Every AI system has a named accountable owner.","evidence":"Ownership/RACI assignments for AI systems."},
      {"key":"AC-02","label":"Approval gate","description":"AI use cases pass a defined approval gate before deployment.","evidence":"An approval workflow, committee, or sign-off requirement for AI."},
      {"key":"AC-03","label":"Human oversight","description":"Consequential AI decisions have human review or override.","evidence":"Human-in-the-loop or override requirements for high-impact decisions."},
      {"key":"AC-04","label":"Third-party AI due diligence","description":"Vendor/third-party AI is subject to the same governance.","evidence":"Procurement or vendor-assessment clauses covering AI."}
    ]}
  ]
}'::jsonb)
on conflict (key) do update set label = excluded.label, config = excluded.config;

-- ── workflow: the baseline diagnostic pipeline ───────────────
-- Prompts are omitted → the step library''s defaults apply; StratAlliance
-- tunes them via Admin → Workflows without a deploy.
insert into public.definitions (kind, key, label, config) values
('workflow', 'baseline_diagnostic', 'AI Deployer Baseline Diagnostic', '{
  "resultType": "assessment",
  "model": "claude-sonnet-5",
  "steps": [
    {"type": "extract"},
    {"type": "assess",    "config": {"rubric": "rai_standard"}},
    {"type": "coherence"},
    {"type": "verdict",   "config": {"thresholds": {"green": 0.8, "amber": 0.5}}},
    {"type": "report",    "config": {"sections": [
      {"key": "verdict",    "title": "Where you stand",        "source": "verdict"},
      {"key": "gaps",       "title": "Governance gaps",        "source": "llm",
        "prompt": "Summarise the most important governance gaps in plain language for a non-technical executive, grouped by theme. Be direct but constructive."},
      {"key": "readiness",  "title": "Deployment readiness",   "source": "llm",
        "prompt": "Assess, in plain language, whether this organisation''s governance is strong enough to support a real AI deployment, or whether it only looks right on paper. Draw on the coherence check."},
      {"key": "next_steps", "title": "What to do next",        "source": "llm", "maxItems": 5,
        "prompt": "Produce a ranked list of the highest-impact next steps to close the identified gaps. Each step: one imperative sentence plus one sentence of why."}
    ]}},
    {"type": "notify",    "config": {
      "emailField": "contact_email",
      "subject": "Your AI Deployer Baseline Diagnostic: {{verdict_label}}",
      "ctas": [
        {"label": "Book a review",             "href": "https://stratalliance.example/book"},
        {"label": "Request a deeper assessment","href": "https://stratalliance.example/assessment"},
        {"label": "Get help closing the gaps",  "href": "https://stratalliance.example/help"}
      ]
    }}
  ]
}'::jsonb)
on conflict (key) do update set label = excluded.label, config = excluded.config;

-- ── form: the public diagnostic intake ───────────────────────
insert into public.definitions (kind, key, label, config) values
('form', 'diagnostic', 'AI Deployer Baseline Diagnostic', '{
  "targetType": "submission",
  "workflow": "baseline_diagnostic",
  "enabled": true,
  "fields": ["contact_name", "contact_email", "organisation", "consent"],
  "presets": {
    "title": "Diagnostic #{{submission_number}} · {{submission_date}}",
    "status": "received",
    "form_key": "{{form_key}}"
  },
  "carryOver": ["contact_name", "contact_email", "organisation"],
  "uploads": {
    "enabled": true,
    "accept": ["pdf", "docx"],
    "maxFiles": 8,
    "minFiles": 1,
    "guidance": "Upload the documents that describe how your organisation governs AI: an AI policy, risk framework, data-handling standard, approval process, or similar. PDF or Word, up to 8 files."
  },
  "copy": {
    "title": "AI Deployer Baseline Diagnostic",
    "intro": "Find out whether your organisation''s AI governance would hold up in a real deployment. Upload your governance documents and receive a clear Green / Amber / Red verdict with a plain-language report. Free, in minutes.",
    "submitLabel": "Run my diagnostic",
    "successNote": "Your documents are being assessed. This usually takes a few minutes. Keep this page open and we''ll take you to your report when it is ready."
  }
}'::jsonb)
on conflict (key) do update set label = excluded.label, config = excluded.config;
