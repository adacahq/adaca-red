-- ─────────────────────────────────────────────────────────────
-- Retire the `assignments` system. People-attachment is consolidated onto
-- definition-driven `user`/`users` fields (which also power "For You"), so the
-- parallel user↔node↔role_key join and its "People" UI are removed.
--
-- DROP TABLE cascades the table's own RLS policies, the `assignments_touch`
-- trigger, the node/user indexes, grants, and the FK to `roles`. The `roles`
-- table is intentionally KEPT, and the system role on `users`
-- (admin/owner/member/viewer) is unrelated and untouched.
-- ─────────────────────────────────────────────────────────────

drop table if exists public.assignments;
