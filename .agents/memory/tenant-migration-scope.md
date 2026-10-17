---
name: Existing data ownership for multi-tenancy
description: User-confirmed organisation ownership when introducing tenant isolation.
---

Everything currently in the system can be assigned to Elysium OSHC. Reuse its existing company record rather than creating another company.

**Why:** The user explicitly confirmed this ownership while requesting an outline for introducing multi-tenancy and said Elysium OSHC already has an associated ID.

**How to apply:** Resolve and verify the existing company record in each environment before any backfill. Preserve existing record IDs and relationships. This establishes the intended ownership of legacy data; it is not permission to publish or perform unreviewed production migrations.
