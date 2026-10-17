---
name: Existing data ownership for multi-tenancy
description: User-confirmed organisation ownership when introducing tenant isolation.
---

Everything currently in the system can be assigned to Elysium OSHC. Reuse its existing company record rather than creating another company.

**Why:** The user explicitly confirmed this ownership while requesting an outline for introducing multi-tenancy and said Elysium OSHC already has an associated ID.

**How to apply:** Resolve and verify the existing company record in each environment before any backfill. Preserve existing record IDs and relationships. This establishes the intended ownership of legacy data; it is not permission to publish or perform unreviewed production migrations.

Keep ownership nullable during the additive migration stage; require it only after legacy data has been assigned in each environment. Do not enable another company before end-to-end tenant isolation is complete.

**Why:** Schema publication does not backfill legacy production records. Requiring ownership or enabling account checks before the production data step would lock out existing users. Adding ownership columns alone does not isolate unscoped queries.

**How to apply:** Treat production data preparation and whole-portal isolation as release prerequisites, not post-publication fixes. Never introduce a permanent Elysium default to avoid a missing-ownership error.
