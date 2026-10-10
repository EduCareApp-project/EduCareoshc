---
name: Browser timer test isolation
description: Avoid confusing Testing Library's polling timers with the feature being tested.
---

Testing Library's `waitFor` can call the same browser timer functions that a feature uses. Do not assume the first spied interval belongs to the feature.

**Why:** A PDF-window cleanup test invoked Testing Library's polling callback instead of the application callback, falsely reporting that a blob URL was never released.

**How to apply:** Wait for the specific application timer and identify its call by distinguishing arguments before manually invoking it.
