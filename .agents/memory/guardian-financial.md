---
name: Guardian financial feature
description: Architecture of the guardian financial accounts, communication log, and payment plans feature
---

## DB tables (created via direct SQL — not drizzle push)
- `guardian_financial_accounts` — one row per guardian email (upserted on first read), status: active | payment_plan | suspended
- `guardian_communication_logs` — timestamped phone call notes, per guardian email
- `guardian_payment_plans` — one_off or recurring payment agreements, per guardian email

Schema file: `lib/db/src/schema/guardian_financial.ts`, exported from `lib/db/src/schema/index.ts`.

## API route
File: `artifacts/api-server/src/routes/guardian-financial.ts`

**Must be registered BEFORE `guardiansRouter`** in `routes/index.ts` — the suspended-report route `/guardians/financial/suspended-report` would otherwise be captured by the `:email` wildcard in the guardians router.

Routes:
- `GET /guardians/financial/suspended-report?siteId=X` — grouped by site, educator roles pass their siteId
- `GET /guardians/:email/financial` — fetch status + communications + plans (upserts account on first call)
- `PATCH /guardians/:email/financial` — update status
- `POST/DELETE /guardians/:email/financial/communications/:id`
- `POST/DELETE /guardians/:email/financial/payment-plans/:id`

## Portal
- `artifacts/portal/src/components/guardian-financial-tab.tsx` — self-contained tab component with status badge/edit, comm log CRUD, payment plans CRUD
- `artifacts/portal/src/pages/guardian-detail.tsx` — added Overview/Financial tab bar; tab state from `new URLSearchParams(window.location.search).get("tab") ?? "overview"`; uses `useLocation` from wouter for navigation
- `artifacts/portal/src/pages/reports-financial.tsx` — suspended guardians report; educator roles auto-filtered to ownSiteId, full-access users see site selector
- Nav: "Financial Accounts" (CreditCard icon) added to REPORTS group in layout.tsx — visible to all roles (server filters for educator roles)

**Why registered before guardiansRouter:** Express route matching is sequential; `/guardians/financial/suspended-report` would match `:email="financial"` if guardians router runs first.
