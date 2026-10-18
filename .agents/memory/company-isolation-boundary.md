---
name: Company isolation boundary
description: Why ordinary portal queries must retain the default-deny database boundary.
---

Keep ordinary portal work behind the restricted company database connection.
Do not replace it with privileged access when a query, import or background job
fails for missing ownership.

**Why:** The portal has many independently evolving queries and helpers. Relying
only on manually remembering a company predicate leaves lists, aggregates and
future endpoints vulnerable to omissions. Default-deny database enforcement is
deliberate defence in depth, not an optional optimisation.

**How to apply:** Establish verified company context for background work and
preserve the separate authenticated support control plane. Provision and review
policy dependencies before activation; keep ownership nullable only for staging,
never by inventing a permanent Elysium fallback. Managed schema changes must
retain the policies or a later schema sync can remove the protection.

Verify authorised account operations under the restricted database role as well
as cross-company denials.

**Why:** A policy can fail closed and pass negative isolation checks while also
blocking legitimate invitations or password recovery. Privileged or mocked
route tests do not exercise those database policies.

**How to apply:** Keep positive issuance/consumption checks for staff and guardian
account tokens alongside foreign-account tampering and single-use checks.
