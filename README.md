# Adaca Red

An **operations platform** for tracking **initiatives**, **risks**, and
**incidents** as a connected register, with **RED analysis**
(Relevance · Extent · Duration) as the scored relationship between an initiative
and the risk it mitigates.

Built on [vinext](https://vinext.io/) (Next.js App Router on Vite, deploys to
Cloudflare Workers) with Tailwind v4, **Supabase** (Postgres + Auth) as the data
layer, and **Microsoft (Entra) SSO** for sign-in.

```
            RED (graded: relevance / extent / duration)
   Initiative ───────────────────────────────▶ Risk
       ▲                                          ▲
       │ remediates                               │ realises
       └──────────────── Incident ────────────────┘
```

## What it does

- **Typed graph, not bespoke tables.** Three domain node types (initiative, risk,
  incident) plus structural ones (group, task), all driven by a `definitions`
  registry. Adding a type or field is data, not a schema migration.
- **RED analysis** lives on the `initiative → risk` edge as four fields
  (relevance, extent, duration, assessment date), with residual-exposure and
  RED-over-time trends derived from the edge's revision history.
- **Definition-driven forms, filters and validation** — one source of truth
  generates the create/edit forms, filter controls and Zod schemas.
- **Configurable enums** — each choice has a key, label and semantic colour, set
  in the admin UI.
- **Kanban boards** for initiative tasks, with drag-to-reorder and a containment
  tree, plus a register table with **CSV / XLSX export**.
- **Per-user customisable dashboards** — build your own view from KPI, table,
  donut, bar, stacked-bar, line and risk-matrix widgets.
- **Reports** — risk matrix, RED coverage, portfolio and incident analytics.
- **Role-based access** (admin / owner / member / viewer) enforced by Postgres
  RLS; sign-in restricted to allowed email domains.
- **Dark-first design** with a light/dark toggle.

## Tech stack

vinext (Next.js 16 on Vite → Cloudflare Workers) · React 19 · Tailwind v4 ·
Supabase (Postgres, Auth, RLS) · Microsoft Entra OAuth · Resend (transactional
email) · recharts.

---

## Getting started

You'll need **Node 22+**, **npm**, a **Supabase** project + the **Supabase CLI**,
and an **Azure / Microsoft Entra** tenant to register the sign-in app.

### 1. Install

```bash
git clone https://github.com/adacahq/adaca-red.git
cd adaca-red
npm install
```

### 2. Create a Supabase project

Create one at <https://supabase.com/dashboard>, then note the **Project URL** and
**anon (publishable) key** from *Project Settings → API*.

### 3. Set up Microsoft (Azure) sign-in

Sign-in is Microsoft only; accounts are provisioned automatically on first login,
restricted to your allowed email domain.

1. **Register an app** in the Azure Portal → *Microsoft Entra ID → App
   registrations → New registration*. Redirect URI (type *Web*):
   `https://<your-project-ref>.supabase.co/auth/v1/callback`. Copy the
   **Application (client) ID** and **Directory (tenant) ID**.
2. **Add a client secret** under *Certificates & secrets* and copy its value.
3. **Enable the provider in Supabase**: *Authentication → Providers → Azure* →
   on, paste the client ID + secret. For a single tenant set the **Azure Tenant
   URL** to `https://login.microsoftonline.com/<your-tenant-id>`.
4. Add your site + redirect URLs under *Authentication → URL Configuration*
   (e.g. `http://localhost:3000` for dev).

### 4. Configure environment

```bash
cp .env.example .env
```

```
VITE_SUPABASE_URL=https://<your-project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<anon-or-publishable-key>
VITE_ALLOWED_EMAIL_DOMAINS=example.com   # comma-separated; only these may sign in
RESEND_API_KEY=<resend-api-key>          # transactional email (server-only)
EMAIL_FROM=Adaca Red <noreply@example.com>  # a verified Resend sender
```

`VITE_*` values are public (RLS protects the data). The domain allowlist is
enforced in `/auth/callback`. `RESEND_API_KEY` / `EMAIL_FROM` are server-only.

### 5. Apply the database schema

```bash
supabase link --project-ref <your-project-ref>
supabase db push
```

(Local alternative, needs Docker: `supabase start` then `supabase db reset`.)

### 6. Bootstrap the first admin

New users sign in with **no role** and see an "access pending" screen until an
admin grants one. Set the first admin by hand after their first login:

```sql
update public.users set role = 'admin' where email = 'you@example.com';
```

From then on, admins/owners assign roles in-app. Roles: `admin` · `owner`
(manage roles + reference data), `member` (read/write), `viewer` (read-only).

### 7. Run it

```bash
npm run dev          # http://localhost:3000 (falls back to 3001 if taken)
```

---

## Scripts

```bash
npm run dev      # vinext dev server
npm run build    # vinext build (all RSC/SSR/client envs) — the authoritative typecheck
npm run start    # serve the production build
npm run deploy   # deploy to Cloudflare Workers
npm run lint     # eslint
```

## Deployment (Cloudflare Workers)

Set `CLOUDFLARE_ACCOUNT_ID` in your environment (kept out of the repo), provide
the same app env on the Worker (`wrangler secret put …` / dashboard vars), and
add the production redirect URL to both Azure and Supabase. Then `npm run deploy`.

---

## Project layout

```
src/
├── app/
│   ├── (app)/            # authenticated, role-gated screens
│   ├── (auth)/           # login + access-pending
│   ├── auth/callback/    # OAuth code exchange
│   ├── layout.tsx        # root layout (theme + toaster)
│   ├── globals.css       # design tokens + component CSS
│   └── proxy.ts          # session refresh (Next 16 middleware)
├── components/
│   ├── ui/               # primitives (Button, Modal, Select, DatePicker, …)
│   ├── entity/           # definition-driven CRUD engine
│   ├── fields/           # per-data-type inputs / displays
│   ├── red/              # RED editor, score, trend, mitigations
│   ├── dashboard/        # customisable widget dashboard
│   ├── reports/          # report visualisations
│   └── canvas/           # editorial layout components
└── lib/
    ├── supabase/         # client / server / types / queries
    ├── definitions/      # config → forms, Zod, choices
    ├── nodes/            # mutation + query server actions
    └── dashboard/        # widget registry + aggregation
supabase/migrations/      # schema, RLS, role helpers, seeded definitions
docs/                     # design system + implementation/dashboard plans
```

---

## Troubleshooting

- **"Access pending"** — expected for a new user; an admin must grant a role (or
  run the bootstrap SQL above).
- **"Email domain … not permitted"** — the email isn't in
  `VITE_ALLOWED_EMAIL_DOMAINS`. Add the domain (restart dev after `.env` changes).
- **Sign-in loops / redirect error** — the Azure redirect URI must exactly match
  `https://<ref>.supabase.co/auth/v1/callback`, and your site URL must be in
  Supabase *URL Configuration*.
- **Empty data / permission denied via the API** — new public tables aren't
  auto-exposed; the migrations `GRANT` to `authenticated` and enable RLS. Confirm
  migrations ran (`supabase migration list`).
- **`tsc` errors about `import.meta.glob` / `Fetcher`** — false positives; the
  authoritative check is `npm run build`.

---

## Support

Questions or issues: [support@adaca.com](mailto:support@adaca.com).

© Adaca. All rights reserved.
