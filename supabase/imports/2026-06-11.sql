-- ─────────────────────────────────────────────────────────────
-- ONE-OFF import — Weekly Stakeholders Meeting, 11 June 2026 (week of 1 Jun).
--
-- Run ONCE against the linked project, AFTER the status-reporting migrations
-- and AFTER 00_reset.sql. NOT a migration. Re-running duplicates rows — only
-- run against a freshly-reset domain.
--
-- Source: "Weekly Stakeholders Meet (1).pptx" (36 slides, 6 projects).
-- Each project → an `initiative`; each weekly briefing → a `status_report`
-- child; KEY DATES → `milestone` children; action-log rows → `task` children;
-- external blockers → `dependency` children; the two "issues that occurred"
-- → `incident` nodes wired back with `remediates` edges.
--
-- ⚠️  DATA TO CONFIRM (flagged inline with `-- CONFIRM:`):
--   • Owner email addresses (roster block below) — guessed from the
--     firstname.lastname@adaca.com convention. Wrong emails will NOT be
--     claimed on first SSO login.
--   • A few contradictory / vague dates and inferred statuses/severities.
--   • Risk registers (ISO's 27, Quality's 4) were NOT enumerated in the deck,
--     so no `risk` nodes are created here; the exec-snapshot risk counts will
--     derive from risks once entered. The two incidents are linked by
--     `remediates` only (no `realises` until the risk register exists).
-- ─────────────────────────────────────────────────────────────

begin;

-- ── 0. Owner roster — pre-seeded stub profiles ───────────────────────────────
-- auth_id NULL; claimed on first SSO login by handle_new_user (claim-by-email).
-- `on conflict (email) do nothing` leaves any already-real profile untouched.
-- CONFIRM every address below before running.
insert into public.users (name, email) values
  ('Lorly Omadto',        'lorly.omadto@adaca.com'),        -- SDR & Marketing PM
  ('Ben Pinkerton',       'ben.pinkerton@adaca.com'),       -- Adaca One & ISO PM
  ('Den Aranas',          'den.aranas@adaca.com'),          -- PH Governance PM
  ('Johrycel Fernandez',  'johrycel.fernandez@adaca.com'),  -- Quality Framework PM
  ('Michael Skeetos',     'michael.skeetos@adaca.com'),
  ('Shaira Catadman',     'shaira.catadman@adaca.com'),
  ('Greg Bryan',          'greg.bryan@adaca.com'),
  ('Mike Uy',             'mike.uy@adaca.com'),
  ('Jhonalyn Monteloyola','jhonalyn.monteloyola@adaca.com'),
  ('Jonathan Trubshaw',   'jonathan.trubshaw@adaca.com'),
  ('Anner Kim',           'anner.kim@adaca.com'),
  ('Fredy Lievano',       'fredy.lievano@adaca.com'),
  ('Lambros Photios',     'lambros.photios@adaca.com')
on conflict (email) do nothing;

-- ── helper functions (dropped at the end) ────────────────────────────────────
create or replace function public._imp_node(p_type text, p_parent text, p_data jsonb,
                                            p_pos int default 0, p_author text default null)
returns text language plpgsql as $fn$
declare v_id text;
begin
  insert into public.nodes (type_key, parent_id, data, position, created_by, current_rev)
  values (p_type, p_parent, p_data, coalesce(p_pos,0), p_author, 1)
  returning id into v_id;
  insert into public.revisions (target_kind, target_id, rev_no, data, author_id, change_note)
  values ('node', v_id, 1, p_data, p_author, 'Import: Weekly Stakeholders pack 11 Jun 2026');
  return v_id;
end $fn$;

create or replace function public._imp_edge(p_type text, p_from text, p_to text,
                                            p_data jsonb default '{}'::jsonb, p_author text default null)
returns text language plpgsql as $fn$
declare v_id text;
begin
  insert into public.edges (type_key, from_id, to_id, data, created_by, current_rev)
  values (p_type, p_from, p_to, p_data, p_author, 1)
  returning id into v_id;
  insert into public.revisions (target_kind, target_id, rev_no, data, author_id, change_note)
  values ('edge', v_id, 1, p_data, p_author, 'Import: Weekly Stakeholders pack 11 Jun 2026');
  return v_id;
end $fn$;

create or replace function public._imp_assign(p_node text, p_user text, p_role text)
returns void language plpgsql as $fn$
begin
  if p_user is null then return; end if;
  insert into public.assignments (node_id, user_id, role_key)
  values (p_node, p_user, p_role)
  on conflict (node_id, user_id, role_key) do nothing;
end $fn$;

-- ── the import ───────────────────────────────────────────────────────────────
do $import$
declare
  -- people
  author     text;
  u_lorly    text; u_ben   text; u_den   text; u_johry text; u_michael text;
  u_shaira   text; u_greg  text; u_mike  text; u_jhona text; u_jonathan text;
  u_anner    text; u_fredy text; u_lambros text;
  -- initiatives
  sdr  text; one  text; iso  text; ph  text; qa  text; mkt text;
  -- incidents
  inc_email text; inc_contracts text;
  -- scratch for tasks needing an assignee
  t text;
begin
  -- resolve people by email
  select id into u_lorly    from public.users where email='lorly.omadto@adaca.com';
  select id into u_ben      from public.users where email='ben.pinkerton@adaca.com';
  select id into u_den      from public.users where email='den.aranas@adaca.com';
  select id into u_johry    from public.users where email='johrycel.fernandez@adaca.com';
  select id into u_michael  from public.users where email='michael.skeetos@adaca.com';
  select id into u_shaira   from public.users where email='shaira.catadman@adaca.com';
  select id into u_greg     from public.users where email='greg.bryan@adaca.com';
  select id into u_mike     from public.users where email='mike.uy@adaca.com';
  select id into u_jhona    from public.users where email='jhonalyn.monteloyola@adaca.com';
  select id into u_jonathan from public.users where email='jonathan.trubshaw@adaca.com';
  select id into u_anner    from public.users where email='anner.kim@adaca.com';
  select id into u_fredy    from public.users where email='fredy.lievano@adaca.com';
  select id into u_lambros  from public.users where email='lambros.photios@adaca.com';
  author := u_lambros;

  -- ════════════════════════════════════════════════════════════════════════
  -- INITIATIVES (one per project) + PM as owner
  -- ════════════════════════════════════════════════════════════════════════
  sdr := public._imp_node('initiative', null, jsonb_build_object(
    'title','SDR Implementation','status','active','health','on_track',
    'phase',1,'percentComplete',8,'budgetTotal',114302,'targetDate','2026-09-01'), 0, author);
  perform public._imp_assign(sdr, u_lorly, 'owner');

  one := public._imp_node('initiative', null, jsonb_build_object(
    'title','Adaca One','status','active','health','on_track','phase',1), 1, author);
  perform public._imp_assign(one, u_ben, 'owner');

  iso := public._imp_node('initiative', null, jsonb_build_object(
    'title','ISO 27001','status','active','health','on_track',
    'phase',1,'percentComplete',74,'budgetTotal',53752,'targetDate','2026-07-13'), 2, author);
  perform public._imp_assign(iso, u_ben, 'owner');

  ph := public._imp_node('initiative', null, jsonb_build_object(
    'title','PH Governance — Contracts','status','active','health','on_track',
    'phase',1,'percentComplete',60), 3, author);
  perform public._imp_assign(ph, u_den, 'owner');

  qa := public._imp_node('initiative', null, jsonb_build_object(
    'title','Quality Framework','status','active','health','on_track',
    'phase',1,'percentComplete',60,'budgetTotal',0,'targetDate','2026-07-01'), 4, author);
  perform public._imp_assign(qa, u_johry, 'owner');

  mkt := public._imp_node('initiative', null, jsonb_build_object(
    'title','Adaca Marketing & Comms','status','active','health','not_started',
    'phase',1,'percentComplete',0), 5, author);
  perform public._imp_assign(mkt, u_lorly, 'owner');

  -- ════════════════════════════════════════════════════════════════════════
  -- 1) SDR IMPLEMENTATION
  -- ════════════════════════════════════════════════════════════════════════
  perform public._imp_node('status_report', sdr, jsonb_build_object(
    'weekOf','2026-06-01','health','on_track','percentComplete',8,'plannedPercent',21,'budgetUsed',0,
    'headline',        E'- Completed key items due this week\n- SDR implementation cost now with Michael for review\n- Orum discounted cost finalised; awaiting contract to review (start 13 Jul)',
    'progressNeeded',  E'1. Recruitment progress: SDRs\n2. Facility location (awaiting contract)\n3. Define Ideal Customer Profile\n4. Review SDR→BDM handoff process\n5. Map SDR call flow\n6. Create training plan (due 19 Jun)',
    'focusNextWeek',   E'- Finalise improved SDR job description\n- Complete final interviews\n- Close off training map\n- Build SDR outreach playbook\n- Create email sequence template',
    'parkedQuestions', E'- First cohort were all-female hires — do we want the same for the pilot?'), 0, author);

  perform public._imp_node('milestone', sdr, jsonb_build_object('title','Staff offers due','plannedDate','2026-06-23','status','on_track'), 1, author);
  perform public._imp_node('milestone', sdr, jsonb_build_object('title','SDR start date','plannedDate','2026-06-29','status','on_track'), 2, author);
  perform public._imp_node('milestone', sdr, jsonb_build_object('title','Orum telephony start','plannedDate','2026-07-13','status','on_track'), 3, author);
  -- Outreach/nesting: 14 Jul confirmed (slide 3's "14 June" was the stale copy).
  perform public._imp_node('milestone', sdr, jsonb_build_object('title','Two-week outreach / nesting','plannedDate','2026-07-14','status','on_track'), 4, author);
  perform public._imp_node('milestone', sdr, jsonb_build_object('title','Go live','plannedDate','2026-09-01','status','on_track'), 5, author);

  t := public._imp_node('task', sdr, jsonb_build_object('title','SDR project budget cost','status','in_progress','dueDate','2026-06-11','notes','Reviewed by Jonathan and Lambros'), 6, author);
  perform public._imp_assign(t, u_michael, 'assignee');
  t := public._imp_node('task', sdr, jsonb_build_object('title','Orum telephony cost and contract','status','in_progress','dueDate','2026-06-15','notes','Brayton Riley to send contract for Adaca to review'), 7, author);
  perform public._imp_assign(t, u_lorly, 'assignee');
  t := public._imp_node('task', sdr, jsonb_build_object('title','Training map initial draft','status','in_progress','dueDate','2026-06-09','notes','For Jonathan and Lambros to review and approve'), 8, author);
  perform public._imp_assign(t, u_lorly, 'assignee');
  t := public._imp_node('task', sdr, jsonb_build_object('title','SDR updated job description','status','in_progress','dueDate','2026-06-12','notes','Shaira did initial revision; edit pen now with Lorly and Lambros'), 9, author);
  perform public._imp_assign(t, u_lorly, 'assignee');

  -- ════════════════════════════════════════════════════════════════════════
  -- 2) ADACA ONE
  -- ════════════════════════════════════════════════════════════════════════
  perform public._imp_node('status_report', one, jsonb_build_object(
    'weekOf','2026-06-01','health','on_track','budgetUsed',0,
    'headline',        E'- Developer (Alexis) onboarded\n- Existing features tested and bugs fixed\n- Contractor payroll feature documented and implemented\n- Payroll feature system test complete\n- Payroll UAT to commence 04 Jun',
    'progressNeeded',  E'1. Payroll UAT (12 Jun)\n2. Rollout planning\n3. Product roadmap planning\n4. Penetration testing\n5. Vulnerability remediation'), 0, author);

  perform public._imp_node('milestone', one, jsonb_build_object('title','Payroll UAT','plannedDate','2026-06-12','status','on_track'), 1, author);

  t := public._imp_node('task', one, jsonb_build_object('title','Payroll UAT','status','in_progress','dueDate','2026-06-12','notes','Jhonalyn to send documented UAT details to Ben and Lambros'), 2, author);
  perform public._imp_assign(t, u_jhona, 'assignee');
  t := public._imp_node('task', one, jsonb_build_object('title','Penetration test, vulnerability remediation & rollout planning','status','in_progress','dueDate','2026-06-19'), 3, author);
  perform public._imp_assign(t, u_ben, 'assignee');

  -- ════════════════════════════════════════════════════════════════════════
  -- 3) ISO 27001
  -- ════════════════════════════════════════════════════════════════════════
  perform public._imp_node('status_report', iso, jsonb_build_object(
    'weekOf','2026-06-01','health','on_track','percentComplete',74,'budgetUsed',0,
    'headline',        E'- Access review completed and submitted as evidence\n- Policy approvals completed\n- Evidence of assets returned for offboarding completed\n- Internal audit on 11 Jun prior to the ISO 27001 assessment\n- Twice-weekly catch-up with ISO audit consultant in progress\n- Penetration testing commenced',
    'progressNeeded',  E'1. Close off 20 overdue tests\n2. Internal audit on 11 Jun\n3. Azure storage security\n4. Cloudflare security\n5. Documentation & evidence gaps for remediation\n6. 7 risk scenarios needing review / approval',
    'focusNextWeek',   E'- Close off all overdue items\n- 79 open tests need remediation and an SLA assigned\n- Evidence completion +5% (52%); control completion +3% (33%)'), 0, author);

  perform public._imp_node('milestone', iso, jsonb_build_object('title','Internal audit','plannedDate','2026-06-11','status','on_track'), 1, author);
  perform public._imp_node('milestone', iso, jsonb_build_object('title','Audit week','plannedDate','2026-07-13','status','on_track'), 2, author);

  -- CONFIRM: slides 12/13 status column was ambiguous in places; verify Done vs Ongoing.
  t := public._imp_node('task', iso, jsonb_build_object('title','Email access breach — root-cause analysis / post-incident review','status','in_progress','dueDate','2026-06-12','notes','For the 5 Jun security incident'), 3, author);
  perform public._imp_assign(t, u_ben, 'assignee');
  t := public._imp_node('task', iso, jsonb_build_object('title','Screenshots of vulnerability notifications (Microsoft, GitHub, Cloudflare, Krebs, NIST, etc.)','status','in_progress','dueDate','2026-06-09'), 4, author);
  perform public._imp_assign(t, u_ben, 'assignee');
  t := public._imp_node('task', iso, jsonb_build_object('title','Screenshots — web filtering (Microsoft Defender, Cloudflare)','status','in_progress','dueDate','2026-06-09'), 5, author);
  perform public._imp_assign(t, u_ben, 'assignee');
  t := public._imp_node('task', iso, jsonb_build_object('title','Supplier/vendor agreements — recent signed agreement as audit evidence','status','done','dueDate','2026-06-09'), 6, author);
  perform public._imp_assign(t, u_lorly, 'assignee');
  t := public._imp_node('task', iso, jsonb_build_object('title','Secure configuration baselines','status','in_progress','dueDate','2026-06-10','notes','In ISO certification folder'), 7, author);
  perform public._imp_assign(t, u_ben, 'assignee');
  t := public._imp_node('task', iso, jsonb_build_object('title','Secure engineering principles — review/update to reflect Adaca practices','status','done','dueDate','2026-06-10','notes','In ISO certification folder'), 8, author);
  perform public._imp_assign(t, u_ben, 'assignee');
  t := public._imp_node('task', iso, jsonb_build_object('title','Schedule vendor security review','status','in_progress','dueDate','2026-06-09'), 9, author);
  perform public._imp_assign(t, u_ben, 'assignee');
  t := public._imp_node('task', iso, jsonb_build_object('title','Security integration tests — GitHub code scanning / security testing evidence','status','in_progress','dueDate','2026-06-11'), 10, author);
  perform public._imp_assign(t, u_ben, 'assignee');
  t := public._imp_node('task', iso, jsonb_build_object('title','Evidence of asset returns during offboarding (forms, acknowledgements, tickets, emails)','status','in_progress','dueDate','2026-06-10'), 11, author);
  perform public._imp_assign(t, u_lorly, 'assignee');
  t := public._imp_node('task', iso, jsonb_build_object('title','Evidence of candidate assessment before hiring (interviews, evaluations)','status','done','dueDate','2026-06-09'), 12, author);
  perform public._imp_assign(t, u_shaira, 'assignee');
  t := public._imp_node('task', iso, jsonb_build_object('title','Complete tests once Intune deployment is finished','status','in_progress','dueDate','2026-06-19'), 13, author);
  perform public._imp_assign(t, u_ben, 'assignee');

  -- ════════════════════════════════════════════════════════════════════════
  -- 4) PH GOVERNANCE — CONTRACTS
  -- ════════════════════════════════════════════════════════════════════════
  perform public._imp_node('status_report', ph, jsonb_build_object(
    'weekOf','2026-06-01','health','on_track','percentComplete',60,'budgetUsed',0,
    'headline',        E'- Audit done — gaps identified and actioned\n- 74 contracts reviewed; 14 with no agreement on file (some dating to 2020), all flagged and being addressed this week\n- New standard contract locked in: PTO removed, 160 hrs/month, monthly invoicing; template signed off\n- 14 unissued contracts being sent today via DocuSign\n- Green light from Jonathan; pending final input from Recruitment and Johrycel',
    'progressNeeded',  E'1. Recruitment to provide service descriptions (Item 2)\n2. Johrycel to confirm SOW-aligned term details (Item 3)\n3. Distribute contracts via DocuSign today\n4. Close off 14 unissued contracts\n5. Monitor and chase contractor signatures',
    'focusNextWeek',   E'- Chase all 74 contractors to sign and return new agreements via DocuSign\n- Address contractor queries — Den as single point of contact\n- Confirm all 14 unissued contracts are signed and on file ahead of audit',
    'parkedQuestions', E'- Recruitment: service descriptions needed per contractor (Item 2) today\n- Johrycel: SOW-aligned term details needed per contractor (Item 3) today'), 0, author);

  perform public._imp_node('milestone', ph, jsonb_build_object('title','DocuSign contracts sent to all 74 contractors','plannedDate','2026-06-04','status','complete'), 1, author);
  perform public._imp_node('milestone', ph, jsonb_build_object('title','Target majority of contracts signed and returned','plannedDate','2026-06-09','status','on_track'), 2, author);

  t := public._imp_node('task', ph, jsonb_build_object('title','Full contractor agreement audit across all 74 records — 14 with no contract identified','status','done','dueDate','2026-06-01','notes','Spreadsheet provided to Sarah covering job offers, agreements & termination-on-notice'), 3, author);
  perform public._imp_assign(t, u_den, 'assignee');
  t := public._imp_node('task', ph, jsonb_build_object('title','New standard contract template finalised — PTO removed, 160 hrs/month, monthly invoicing','status','done','dueDate','2026-06-04','notes','PTO also excluded from email communications; approved by Jonathan'), 4, author);
  perform public._imp_assign(t, u_den, 'assignee');
  t := public._imp_node('task', ph, jsonb_build_object('title','Confirm service description per contractor (Item 2)','status','in_progress','dueDate','2026-06-04','notes','Required before DocuSign can be sent'), 5, author);
  perform public._imp_assign(t, u_den, 'assignee');
  t := public._imp_node('task', ph, jsonb_build_object('title','Confirm SOW-aligned term for each contractor (Item 3)','status','in_progress','dueDate','2026-06-01','notes','No default time period — must align to each contractor''s SOW per Michael'), 6, author);
  perform public._imp_assign(t, u_den, 'assignee');
  t := public._imp_node('task', ph, jsonb_build_object('title','Distribute new contracts to all 74 contractors via DocuSign','status','in_progress','dueDate','2026-06-04','notes','Go-ahead from Jonathan; includes 14 with no prior contract on file'), 7, author);
  perform public._imp_assign(t, u_den, 'assignee');
  t := public._imp_node('task', ph, jsonb_build_object('title','Document post-incident report for the 14 no-contracts risk, detailing mitigation steps','status','in_progress','dueDate','2026-06-09'), 8, author);
  perform public._imp_assign(t, u_den, 'assignee');
  t := public._imp_node('task', ph, jsonb_build_object('title','Monitor DocuSign responses and chase outstanding signatures (all 74 contractors)','status','in_progress','dueDate','2026-06-09','notes','Target majority signed and returned by next check-in'), 9, author);
  perform public._imp_assign(t, u_den, 'assignee');
  t := public._imp_node('task', ph, jsonb_build_object('title','Address contractor queries on new agreement terms','status','in_progress','dueDate','2026-06-12','notes','Den as the single point of contact'), 10, author);
  perform public._imp_assign(t, u_den, 'assignee');
  t := public._imp_node('task', ph, jsonb_build_object('title','Confirm all 74 contractors have transitioned to the new standard agreement','status','in_progress','dueDate','2026-06-09'), 11, author);
  perform public._imp_assign(t, u_den, 'assignee');
  t := public._imp_node('task', ph, jsonb_build_object('title','Update Monday.com Employee Database records, aligned with latest SOWs','status','in_progress','dueDate','2026-06-16'), 12, author);
  perform public._imp_assign(t, u_den, 'assignee');

  -- ════════════════════════════════════════════════════════════════════════
  -- 5) QUALITY FRAMEWORK
  -- ════════════════════════════════════════════════════════════════════════
  perform public._imp_node('status_report', qa, jsonb_build_object(
    'weekOf','2026-06-01','health','on_track','percentComplete',60,'budgetUsed',0,
    'headline',        E'- Identified operational gaps impacting customer experience\n- Defined 5 measurable performance pillars\n- Proposed coaching, observation and PIP framework\n- Introduced accountability ownership model\n- Recommended pilot implementation',
    'progressNeeded',  E'1. Finalise RACI ownership\n2. Finalise 5 pillars\n3. Select pilot customer (IFM, Intellischool)\n4. Finalise scorecard metrics and ownership\n5. Coaching & PIP framework rollout\n6. Performance dashboard build',
    'focusNextWeek',   E'- Finalise RACI ownership and accountability across departments\n- Select pilot customer\n- Align on scorecard metrics and metric ownership\n- Finalise coaching and PIP templates\n- Define requirements for the performance dashboard',
    'parkedQuestions', E'- Head of Delivery: validate technical metrics; scorecard ownership; dashboard requirements & build\n- HR: finalise coaching & PIP governance; observation periods\n- Leadership: approve ownership model, framework, metrics, dashboard and pilot rollout'), 0, author);

  perform public._imp_node('milestone', qa, jsonb_build_object('title','RACI & ownership alignment','plannedDate','2026-06-08','status','at_risk'), 1, author);
  perform public._imp_node('milestone', qa, jsonb_build_object('title','Pilot customer selection','plannedDate','2026-06-13','status','on_track'), 2, author);
  perform public._imp_node('milestone', qa, jsonb_build_object('title','Dashboard requirements finalised','plannedDate','2026-06-20','status','on_track'), 3, author);
  perform public._imp_node('milestone', qa, jsonb_build_object('title','Pilot launch','plannedDate','2026-07-01','status','on_track'), 4, author);

  -- CONFIRM: deck gave only "June"/"July" for these — left dueDate blank, target in notes.
  t := public._imp_node('task', qa, jsonb_build_object('title','Finalise RACI ownership','status','todo','notes','Target: June'), 5, author);
  perform public._imp_assign(t, u_johry, 'assignee');
  t := public._imp_node('task', qa, jsonb_build_object('title','Metric validation','status','todo','notes','Target: June'), 6, author);
  perform public._imp_assign(t, u_mike, 'assignee');
  t := public._imp_node('task', qa, jsonb_build_object('title','Pilot customer select','status','todo','notes','Target: July; Johrycel + Jonathan'), 7, author);
  perform public._imp_assign(t, u_johry, 'assignee');
  perform public._imp_assign(t, u_jonathan, 'assignee');
  t := public._imp_node('task', qa, jsonb_build_object('title','Dashboard build','status','todo','notes','Target: July; Delivery + Johrycel + Fredy'), 8, author);
  perform public._imp_assign(t, u_johry, 'assignee');
  perform public._imp_assign(t, u_fredy, 'assignee');
  t := public._imp_node('task', qa, jsonb_build_object('title','Coaching & PIP framework','status','todo','notes','Target: June; owned by HR'), 9, author);

  perform public._imp_node('dependency', qa, jsonb_build_object('title','Framework approval and ownership support','source','Leadership','status','on_track','notes','Needed by pilot launch'), 10, author);
  perform public._imp_node('dependency', qa, jsonb_build_object('title','RACI ownership finalised','source','Department leads','neededBy','2026-06-15','status','at_risk'), 11, author);
  perform public._imp_node('dependency', qa, jsonb_build_object('title','Coaching & PIP process agreed','source','HR and Delivery','neededBy','2026-06-15','status','at_risk'), 12, author);
  perform public._imp_node('dependency', qa, jsonb_build_object('title','Scorecard metrics validated & performance dashboard implemented','source','Delivery','status','at_risk','notes','Needed by pilot launch'), 13, author);

  -- ════════════════════════════════════════════════════════════════════════
  -- 6) ADACA MARKETING & COMMS
  -- ════════════════════════════════════════════════════════════════════════
  perform public._imp_node('status_report', mkt, jsonb_build_object(
    'weekOf','2026-06-01','health','not_started','percentComplete',0,'budgetUsed',0,
    'headline',        E'- Commencing week of 8 Jun\n- Update leadership page on website\n- Add links to case studies from the industry page per vertical (Fintech, Superannuation, Technology, Logistics & Supply Chain, Mining & Construction, Channel)',
    'progressNeeded',  E'1. Add an update page on the previous RoundTable + invite poster for the 16 Jun virtual RoundTable\n2. Add a "click here" link for the free discovery session\n3. Add more client verbatims on Home / Case Studies\n4. Email marketing campaign with BDMs (HubSpot and Lineer)',
    'parkedQuestions', E'- "Talk to your own concierge" — a Contact Us link to BDMs to explore a customised solution'), 0, author);

  perform public._imp_node('milestone', mkt, jsonb_build_object('title','Virtual RoundTable','plannedDate','2026-06-16','status','on_track'), 1, author);

  t := public._imp_node('task', mkt, jsonb_build_object('title','Email campaign — HubSpot','status','in_progress','dueDate','2026-06-19','notes','Completed test send'), 2, author);
  perform public._imp_assign(t, u_greg, 'assignee');
  t := public._imp_node('task', mkt, jsonb_build_object('title','Email campaign — Lineer','status','in_progress','dueDate','2026-06-19','notes','Owner: All'), 3, author);
  t := public._imp_node('task', mkt, jsonb_build_object('title','Share learnings & objections from Adaca Sales Day with Lambros','status','done','dueDate','2026-06-19'), 4, author);
  perform public._imp_assign(t, u_greg, 'assignee');
  perform public._imp_assign(t, u_anner, 'assignee');
  t := public._imp_node('task', mkt, jsonb_build_object('title','Add links to case studies from the industry page per vertical','status','in_progress','dueDate','2026-06-19'), 5, author);
  perform public._imp_assign(t, u_lorly, 'assignee');
  t := public._imp_node('task', mkt, jsonb_build_object('title','Add a RoundTable summary with pics and videos','status','in_progress','dueDate','2026-06-09'), 6, author);
  perform public._imp_assign(t, u_lambros, 'assignee');
  t := public._imp_node('task', mkt, jsonb_build_object('title','Add an invite poster for the 16 Jun virtual RoundTable','status','in_progress','dueDate','2026-06-09'), 7, author);
  perform public._imp_assign(t, u_lambros, 'assignee');
  t := public._imp_node('task', mkt, jsonb_build_object('title','Add a "click here" link for the free discovery session','status','in_progress','dueDate','2026-06-09'), 8, author);
  perform public._imp_assign(t, u_lorly, 'assignee');
  t := public._imp_node('task', mkt, jsonb_build_object('title','Add more client verbatims on Home / Case Studies (as relevant)','status','in_progress','dueDate','2026-06-09'), 9, author);
  perform public._imp_assign(t, u_lorly, 'assignee');
  t := public._imp_node('task', mkt, jsonb_build_object('title','Add Tony Lam''s interview with Lambros on Crawl. Walk. Run.','status','in_progress','dueDate','2026-06-12'), 10, author);
  perform public._imp_assign(t, u_lambros, 'assignee');

  -- ════════════════════════════════════════════════════════════════════════
  -- INCIDENTS (the two "issues that occurred") + remediates edges
  -- CONFIRM: severities inferred; no `realises` edge until the risk register exists.
  -- ════════════════════════════════════════════════════════════════════════
  inc_email := public._imp_node('incident', null, jsonb_build_object(
    'title','Email access security breach (5 Jun 2026)','status','investigating','severity','sev2',
    'occurredAt','2026-06-05','detectedAt','2026-06-05',
    'summary','Unauthorised access to a corporate email account.',
    'impact','Under assessment as part of the post-incident review.',
    'rootCause','Root-cause analysis in progress; evidence captured for ISO 27001.'), 0, author);
  perform public._imp_assign(inc_email, u_ben, 'owner');
  perform public._imp_edge('remediates', iso, inc_email, '{}'::jsonb, author);

  inc_contracts := public._imp_node('incident', null, jsonb_build_object(
    'title','14 contractors with no agreement on file','status','investigating','severity','sev3',
    'detectedAt','2026-06-01',
    'summary','Audit of 74 contractor records found 14 with no agreement on file, some dating back to 2020.',
    'impact','Contractual / compliance exposure; addressed via new standard agreements issued by DocuSign.',
    'rootCause','To be documented in the post-incident report (see PH Governance action item).'), 1, author);
  perform public._imp_assign(inc_contracts, u_den, 'owner');
  perform public._imp_edge('remediates', ph, inc_contracts, '{}'::jsonb, author);

  raise notice 'Import complete.';
end
$import$;

-- summary + cleanup
do $summary$
declare n_nodes int; n_edges int; n_assign int;
begin
  select count(*) into n_nodes from public.nodes;
  select count(*) into n_edges from public.edges;
  select count(*) into n_assign from public.assignments;
  raise notice 'Imported: % nodes, % edges, % assignments', n_nodes, n_edges, n_assign;
end $summary$;

drop function public._imp_node(text, text, jsonb, int, text);
drop function public._imp_edge(text, text, text, jsonb, text);
drop function public._imp_assign(text, text, text);

commit;
