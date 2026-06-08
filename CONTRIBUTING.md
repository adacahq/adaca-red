# Contributing to Adaca Red

Thanks for your interest in contributing. This guide covers the workflow and the
conventions that keep the codebase consistent.

## Getting set up

See the [README](README.md) for full setup (Node 22+, Supabase, Microsoft SSO,
env vars, migrations). In short:

```bash
git clone https://github.com/adacahq/adaca-red.git
cd adaca-red
npm install
cp .env.example .env   # fill in your values
npm run dev
```

## Workflow

`main` is protected: it can't be pushed to directly, and merges happen through
pull requests once CI passes.

1. Branch off `main`: `git checkout -b feature/short-description`.
2. Make your change. Keep commits focused and messages clear.
3. Run the checks locally (see below) — they must pass.
4. Open a pull request against `main`. CI (build + lint) runs automatically and
   must be green before the PR can merge. Resolve any review conversations.
5. Keep your branch up to date with `main` before merging.

## Checks (run before pushing)

```bash
npm run build   # the AUTHORITATIVE typecheck (vinext build, all RSC/SSR/client envs)
npm run lint    # eslint
```

> `npx tsc --noEmit` reports false positives for `import.meta.glob` and the
> Cloudflare `Fetcher` global. Trust `npm run build`, not `tsc`.

## Conventions

**Domain model — a typed graph.** A few node types (`initiative`, `risk`,
`incident`, plus structural `group`/`task`) and edge types, all driven by a
`definitions` registry. Add a node/edge type or field by adding a **definition
row** (seed migration / admin UI), not a bespoke table. RED is a graded edge on
`initiative → risk` only.

**Database rules (strict).**
- Every table's first three columns are `id, created_at, updated_at`, in that order.
- `id` is a 10-char lowercase-alphanumeric nanoid (`public.nanoid()` default), not a serial/uuid.
- Table names are plural; status/lifecycle/title live in a `data`/`config` jsonb field, not columns.
- Soft delete via `deleted_at`; queries filter `deleted_at is null`.
- RLS is on for every table and is role-based. New public tables must be `GRANT`ed to `authenticated`.
- Writes to `nodes`/`edges` go through the mutation RPCs (`save_node`/`save_edge`/`soft_delete_*`), never direct table writes from the app.
- Make schema changes as migrations in `supabase/migrations/`; apply with `supabase db push`.

**UI.**
- Use the shared primitives in `src/components/ui/` — `Modal`, `Confirm` (`useConfirm()`), `Select`, `DatePicker`, `RichText`. No native `<select>`, and never `window.confirm/alert/prompt`.
- Forms, filters and validation are generated from `definitions.config.fields` (one source of truth → form + filter + Zod).
- Stay on-brand: ultra-dark canvas, orange-only accent, hairlines, mono uppercase labels (see `docs/design-system.md`). Colour goes via `var(--token)`, layout via Tailwind.

**Content / copy.**
- UK English (`organisation`, `utilisation`, …).
- No em dashes in user-facing text — use a comma, colon, or full stop.
- Concise and direct; let numbers carry the claim.

## Reporting issues

Open a GitHub issue, or email [support@adaca.com](mailto:support@adaca.com).

By contributing, you agree that your contributions are licensed under the
[MIT License](LICENSE).
