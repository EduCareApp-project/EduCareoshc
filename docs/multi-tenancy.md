# Company isolation

## Release restriction

**Development isolation is implemented. Production release remains blocked until
the separate production preparation and recovery procedure has been reviewed.**
Do not publish these changes or onboard real production companies on this basis.
Production startup also requires `TENANT_ISOLATION_RELEASE_APPROVED=reviewed`,
as well as the provisioned database safeguards and complete ownership backfill.
Do not set that approval flag as a substitute for the review.

Only development data and schema have been prepared. Existing records belong to
the existing Elysium OSHC company; do not create a replacement company, rewrite
passwords or record IDs, or invent service codes.

## Request and database boundary

- Account membership is re-read on every protected request. Staff role, site and
  email are refreshed from the account; blocked accounts fail closed. Guardian
  ownership comes from the stored account, and school ownership from its stored
  service. Caller/session company IDs cannot override membership.
- Normal `db` queries use request-local ownership and a restricted, non-login,
  non-superuser, non-RLS-bypass database role. Connections establish the company
  before queries and reset their role/settings before returning to the pool.
  Missing context or missing provisioning is an error, never a global fallback.
- All 82 portal data tables have managed row-level policies. Reads, aggregates,
  exports, updates and deletes cannot see another company. Writes require the
  verified owner and same-company parent references, including integer child and
  outcome arrays. MTOP text codes are not database record IDs.
- Ownership remains nullable for migration staging. Runtime policies reject
  unowned writes/reads, and startup refuses unassigned records. Context-derived
  defaults are not permanent defaults to Elysium.
- The privileged database handle is limited to authenticated support control
  plane operations, membership/credential routing, opaque session storage,
  readiness checks and explicitly authorised development setup. Do not use it
  to bypass a failed tenant query. Kidsoft's quiet database connection uses the
  same restricted pool as other portal queries.
- Existing staff, school-site and onboarding restrictions remain. Guardians
  cannot enter generic staff routes or use their numeric account IDs as staff
  identities; their comments, posts, plans and excursions are child-scoped.

## Identity, files and background work

- Staff emails, guardian emails, school usernames, financial account identities,
  notification deduplication and service codes are company-scoped. An identity
  shared by companies requires the correct organisation code at sign-in or
  password-reset request. Unique existing identities still work without a code.
- Invitation/reset links include company routing. Reset tokens bind both owner
  and exact account ID. Historical tokens without an unambiguous account binding
  fail closed and require a fresh request; existing passwords are unchanged.
- Guardian-child email matching is company-scoped and case/whitespace tolerant.
  Related staff, children, services, medications and financial plan IDs cannot
  be substituted across companies.
- Service identifiers are optional, manually supplied and company-unique; they
  are never assigned from service names or sequence IDs.
- Private uploads and generated documents have company file provenance. Storage
  rejects an unowned path before contacting cloud storage. Stored document paths
  must reference that company's registered files. Failed merges retain their
  original source records/files.
- Public document/QIP/logo routes resolve ownership from a stored public
  resource, service, or explicit company identifier before querying. Legacy
  anonymous links without routing work only when there is exactly one company;
  ambiguity fails closed. Signed-in requests stay in their verified company.
- Branding and PDFs use that company, not the first organisation. Protected
  responses are not browser/shared-cacheable; switching accounts clears the
  portal query cache.
- Background document cleanup iterates explicit company contexts. Inbox and
  Kidsoft refresh state include company ownership. Business integrations require
  an owned credential-name binding; there is no global Kidsoft/ClickUp fallback.
  Tenants cannot choose or edit secret-name bindings. Shared platform services
  such as transactional email remain infrastructure, without an Elysium BCC.

## Development preparation

`scripts/post-merge.sh` runs the development-only setup before and after schema
sync. It provisions policy dependencies, safely assigns legacy ownership only
when the existing Elysium company is unambiguous, records file provenance and
restores restricted grants. Multiple companies plus unassigned data require
explicit review rather than guessed ownership.

The schema tracks policies and the support registry so schema sync cannot
silently remove RLS or discard an excluded table's serial sequence. The schema
push wrapper uses a TTY, accepts only the explicit no-truncation constraint
choice, and requires a real success marker with no reported SQL error.

**Never run the development setup against production.** Production needs a
separately reviewed, supported schema/role/function/backfill procedure, verified
file provenance and integration ownership, backup/recovery checks, and only
then release approval. Never replace production data with the development DB.
The API performs readiness checks, not startup business-data migrations.

## Verification

The opt-in PostgreSQL checks always roll back and refuse production:

```sh
RUN_TENANT_DB_TESTS=1 pnpm --filter @workspace/api-server run test
```

The foundation suite covers tampered CRUD/nested IDs, shared staff/guardian
emails, account-bound resets, financial records, settings, layouts and every
portal account role. The native isolation suite exercises every portal table,
parent references, child/outcome arrays, file references and concurrently reused
connections. Storage unit tests confirm rejected paths never reach the cloud.

A browser account-switch check additionally verifies ambiguous login refusal,
company A/B child lists, sign-out/sign-in with a shared email, persisted company
B sessions, and a 404 for company A's child from B. Browser fixtures are removed
after verification. Passing development checks does not remove the production
release restriction.
