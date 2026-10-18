---
name: Post-merge schema sync
description: Safety requirements for unattended schema reconciliation.
---

Treat successful schema synchronization as a verified postcondition, not an
assumption based on exit status. Never approve data truncation or an unrelated
table rename to make an unattended setup proceed.

**Why:** Schema tools can stop at interactive choices or report SQL errors without
a failing exit status. Apparently successful setup can leave application
constraints or isolation safeguards incomplete.

**How to apply:** Require explicit non-destructive completion, keep setup
idempotent, and manage policy dependencies and intentionally unmanaged database
objects deliberately. If safe completion cannot be established, stop release
rather than guessing or discarding existing data.
