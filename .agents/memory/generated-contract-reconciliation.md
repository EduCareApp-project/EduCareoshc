---
name: Generated contract reconciliation
description: How to safely add an OpenAPI endpoint when generated output exposes unrelated baseline contract drift.
---

When OpenAPI code generation produces broad unrelated changes, preserve the established generated contracts used by existing callers and retain only the additions required for the new endpoint. Treat updating the rest of the generated surface as a separate, deliberately scoped migration.

**Why:** The API specification and generated baseline can move out of lockstep. Accepting all newly generated changes at once can remove fields or alter hook signatures that active portal pages still depend on, turning a focused endpoint change into unrelated breakage.

**How to apply:** After generation, inspect the generated diff and portal typecheck. Keep the new operation, its client hook, Zod validator, response types, and type-barrel exports; restore unrelated generated output unless all dependent callers are updated and verified together.