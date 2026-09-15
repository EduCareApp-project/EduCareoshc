---
name: Excursion document provenance
description: Security boundary for uploaded excursion risk assessments.
---

Excursion risk assessments must use a permanently reserved private-object prefix, a dedicated authorised read route, and a provenance record tying each upload to its site and staff uploader before it can be claimed by an excursion.

**Why:** Checking only the excursion’s current document pointer leaves replaced or orphaned files accessible through generic storage. A prefix alone prevents generic reads but does not prevent a cross-site user from rebinding a known path. PDF type also needs server-side content verification and safe response headers.

**How to apply:** Authorise the site before issuing an upload URL; record path, site, and uploader; atomically claim the unclaimed record during excursion create/update; reject generic reads for the reserved prefix; verify the PDF signature and force safe PDF headers on authorised downloads.