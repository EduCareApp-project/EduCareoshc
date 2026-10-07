---
name: Emergency heading persistence
description: Account-backed restoration of independent open/closed headings on service compliance
---

Emergency record headings must independently remember their last open/closed state when the user returns to service compliance. Save these preferences against the staff account, not solely in browser storage.

**Why:** The user reported all headings reopening expanded after returning later, despite the published assets already including the browser-only persistence implementation. Browser-only saving did not satisfy the requested reliability.

**How to apply:** Account settings are authoritative across reloads and browsers. Import earlier browser settings only when the account has never saved settings, and retain browser storage as a fallback. Keep accounts isolated and save changes in click order so rapid toggles preserve the final choice. Do not silently treat failed saves as successful.
