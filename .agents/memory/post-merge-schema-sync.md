---
name: Post-merge schema sync
description: Non-interactive post-merge database setup behavior.
---

The post-merge schema synchronization must explicitly answer “no” to Drizzle’s populated-table truncation prompts because post-merge runs with stdin closed. It also needs a timeout that covers dependency installation and schema introspection.

**Why:** Drizzle’s force mode does not suppress every destructive-data confirmation, so an unattended task merge can otherwise hang until the setup timeout.

**How to apply:** Keep post-merge database commands idempotent and pipe a safe no-truncate response where prompts remain; increase the configured timeout only enough to cover normal setup work.