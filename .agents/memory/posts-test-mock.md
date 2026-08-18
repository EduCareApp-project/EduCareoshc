---
name: Posts test mock pattern
description: How the posts.test.ts DB mock must be structured to handle chained groupBy and multi-request tests
---

## Rule
`subChain` must be a **thenable** (has `then`/`catch` that resolve to `[]`) AND every method (`from`, `where`, `groupBy`, `orderBy`) must return `subChain`. Never use `mockResolvedValue` for `subChain.where` — that breaks `.groupBy()` chaining.

**Why:** The GET /api/posts route now uses `.groupBy()` after `.where()` for comment count aggregation. If `where()` returns a Promise (via `mockResolvedValue`), calling `.groupBy()` on it throws TypeError.

## How to apply
- In the hoisted mock block, define `subChain` with `then`/`catch` properties before setting vi.fn() chain methods.
- In `beforeEach` and any mid-test `vi.clearAllMocks()` re-wiring blocks, set `subChain.where` with `.mockReturnValue(subChain)` and add `(subChain.groupBy as ...).mockReturnValue(subChain)`.
- Any new table imported in the posts route must be added to the `vi.mock("@workspace/db", ...)` object or it comes in as `undefined` and causes 500s across all tests.
