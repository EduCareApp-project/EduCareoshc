---
name: Post-merge schema sync
description: Non-interactive post-merge database setup behavior.
---

The post-merge schema synchronization must explicitly answer “no” to Drizzle’s populated-table truncation prompts because post-merge runs with stdin closed. It also needs a timeout that covers dependency installation and schema introspection. Never accept an unrelated-table rename suggestion for a genuinely new table; create the new table explicitly instead.

**Why:** Drizzle’s force mode does not suppress every destructive-data confirmation, and schema introspection can misidentify an unrelated existing table as a rename candidate for a new table.

**How to apply:** Keep post-merge database commands idempotent and pipe a safe no-truncate response where prompts remain. When a new-table prompt offers unrelated rename candidates, reject the rename and use idempotent `CREATE TABLE IF NOT EXISTS` DDL in development.