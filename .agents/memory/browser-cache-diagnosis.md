---
name: Browser-cache diagnosis
description: Distinguishing existing-browser loading failures from authentication or published-code regressions
---

When login succeeds and the published frontend renders in a fresh browser, investigate the affected browser's cached assets before changing authentication or unrelated feature logic.

**Why:** The user confirmed that Command + Shift + R resolved a completely white Chrome page after login. Published login and dashboard rendering had passed fresh-browser checks. This points to stale browser files; the exact failed cached resource was not captured.

**How to apply:** Treat fresh-browser checks as only one part of diagnosis. Compare the affected browser's asset requests and console errors with the current published assets, and distinguish a cache-related recovery from a code fix.