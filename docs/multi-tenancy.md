# Multi-tenancy development rollout

## Release restriction

**This is a staged implementation, not a multi-tenant release. Do not onboard a
second organisation into the portal or publish this stage on its own.** Remaining
routes still contain unscoped queries. Verified ownership is necessary, but is
not equivalent to full data isolation.

The user authorised development implementation only. Production data and schema
have not been changed. Existing records belong to the existing Elysium OSHC
organisation; never create a replacement company or assign invented service
codes.

## Foundation implemented

- Staff, guardian accounts and children have nullable `organisation_id` foreign
  keys. The existing service `org_id` now has an organisation foreign key.
- Nullable columns are deliberate for the staged rollout. They must become
  required only after legacy data in the target environment is safely assigned.
  There is no permanent default organisation.
- The development backfill assigned existing roots to the verified Elysium
  record. Historical, inactive and archived roots were included. Record IDs,
  credentials, files and business fields were not rewritten.
- `organisation-context.ts` resolves the authenticated account's current
  database ownership on each protected request. It does not trust a company ID
  from a request or session. School ownership is derived through the account's
  stored service, not the session's site ID. Missing ownership fails closed.
- Ownership is request-local, so existing sessions do not need a guessed tenant
  attached to them. Separate Super Admin routes remain outside the portal guard.
- Existing school and onboarding access gates remain in place.
- Portal creation/import paths for staff, children, guardians and services set
  ownership server-side. Seed scripts and future background creation paths must
  explicitly supply ownership.
- Organisation calendar operations and dashboard layout operations use verified
  account ownership. Company settings select/update that organisation, not the
  first database row. Company writes require administrator/director access.
- Insert validation schemas exclude the server-owned organisation field.

## Remaining isolation work — release blockers

1. **All application data paths:** scope every list, detail, aggregate, create,
   update and delete, including observations, jottings, posts, planning,
   compliance, notifications, financial records, reports and exports. Scope
   related-ID lookups, imports and conflict/update paths as well, not only lists.
2. **Relationship integrity:** enforce same-organisation site/child/staff links,
   including staff-site assignments and account creation. Add ownership to
   independently owned tables; inherited ownership must use enforced parents.
   Distinguish truly global reference data from tenant-editable compliance data.
3. **Authentication/account operations:** support organisation-scoped identities
   and guardian-child matching, password resets and invitation flows. Current
   email/username uniqueness and credential lookup remain global. Preserve
   existing passwords and do not introduce ambiguous email-only tenant routing.
4. **Uniqueness:** change global service-code uniqueness to company-level
   uniqueness, with corresponding collision checks and safe schema rollout.
5. **Files and integrations:** tenant-check all private file reads/downloads,
   public links, merges, PDF generation, email branding, Kidsoft mappings and
   snapshots, ClickUp and other integrations.
6. **Background work:** give scheduled reminders, notifications, jobs and caches
   explicit organisation context. Remove singleton/first-company lookups from
   settings/branding helpers, not just the three scoped routers.
7. **Whole-portal validation:** add two-company coverage for all roles and
   tampered relationship IDs, imports, duplicate identities/codes, files,
   exports, background notifications and school/guardian boundaries.
8. **Production preparation:** review a supported production legacy-data backfill
   and recovery procedure before release, then enforce required ownership and
   ownership-safe constraints. Replit-managed schema changes go through Publish.
   Never add startup DDL, production migration scripts, deployment schema hooks
   or replace production data with the development database.

## Checks

API unit tests cover context resolution, tampered company parameters, stale
session ownership, missing membership and database failure, plus existing
calendar and dashboard draft behavior.

`tenant-foundation.integration.test.ts` uses two temporary organisations inside
transactions that always roll back. It exercises calendar CRUD isolation,
company settings, layout reads, guardian ownership and school ownership against
PostgreSQL. It is opt-in and refuses production:

```sh
RUN_TENANT_DB_TESTS=1 pnpm --filter @workspace/api-server exec vitest run \
  --config vitest.config.ts src/routes/tenant-foundation.integration.test.ts
```

Passing foundation tests does not certify unscoped parts of the portal.
