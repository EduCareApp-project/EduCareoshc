# EduCare Portal

A compliance and documentation management portal for Education and Care businesses in Australia, built around the National Law and My Time Our Place (MTOP) framework.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 8080)
- `pnpm --filter @workspace/portal run dev` — run the portal frontend
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend: React + Vite + Tailwind CSS + Wouter routing
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `lib/api-spec/openapi.yaml` — OpenAPI spec (source of truth for all API contracts)
- `lib/db/src/schema/` — Drizzle DB schema (children, staff, observations, programs, nqs_areas, outcomes)
- `artifacts/api-server/src/routes/` — Express route handlers (children, staff, observations, programs, nqs, outcomes, dashboard)
- `artifacts/portal/src/` — React frontend

## Architecture decisions

- MTOP outcome IDs stored as integer arrays directly on observation/program rows (no junction table) — simple and sufficient for reporting
- Drizzle `date` columns accept strings; Zod OpenAPI schemas generate string date types, so routes cast with `as any` when inserting/updating date fields
- NQS areas and MTOP outcomes are seeded as static reference data — they don't change, only status/notes are updated
- Dashboard endpoints compute counts from existing tables at query time — no separate aggregation tables needed at this scale
- All API routes validate both input and output with `@workspace/api-zod` schemas from codegen

## Product

- **Dashboard** — centre metrics, recent observations, MTOP outcome usage chart, NQS compliance status
- **Children** — enrol children, view profiles with linked observations, track by age group and status
- **Staff** — manage educators with roles, qualifications, and WWCC numbers
- **Observations** — document children's learning linked to MTOP outcomes and programs
- **Programs** — plan educational experiences linked to MTOP outcomes and age groups
- **NQS Compliance** — track all 7 National Quality Standard areas with status and review notes
- **MTOP Outcomes** — reference page for all 5 My Time Our Place framework outcomes

## MTOP Framework (My Time Our Place)

1. Children have a strong sense of identity
2. Children are connected with and contribute to their world
3. Children have a strong sense of wellbeing
4. Children are confident and involved learners
5. Children are effective communicators

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Email

Transactional emails (password reset, login instructions, post notifications) are sent via **Resend SMTP relay**. Credentials are stored as Replit Secrets.

- Provider: Resend (resend.com) — free tier, 3,000 emails/month
- SMTP relay: `smtp.resend.com`, port `465`, SSL/TLS
- `SMTP_USER` = `resend` (literal), `SMTP_PASS` = Resend API key (starts with `re_`)
- `SMTP_FROM` = `onboarding@resend.dev` (Resend sandbox sender — pre-authorised for testing)
- **To send from `system@educareoshc.com.au`**: verify the domain at resend.com/domains, add the DNS records in Crazy Domains, then update the `SMTP_FROM` secret to `system@educareoshc.com.au`
- Implementation: `artifacts/api-server/src/lib/email.ts` — uses nodemailer; logs a warning and skips if `SMTP_HOST`/`SMTP_USER`/`SMTP_PASS` are absent
- The `RESEND_API_KEY` secret is also present but not used by the app — it can be removed

## Gotchas

- After changing `lib/api-spec/openapi.yaml`, always run `pnpm --filter @workspace/api-spec run codegen` before using updated types
- After adding new schema files to `lib/db/src/schema/`, run `pnpm run typecheck:libs` to rebuild the DB lib before typechecking artifacts
- Drizzle `date` columns expect string values — Orval-generated Zod schemas treat date-format fields as strings at the API layer, but drizzle-zod infers them as Date objects in the insert schema. Use `as any` cast when passing parsed API request data to Drizzle insert/update.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
