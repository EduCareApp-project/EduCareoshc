---
name: Test account normalization
description: Avoid false login failures from directly seeded test accounts
---

Normalize the entire email address to lowercase when inserting disposable test accounts directly into the development database, including any random suffix.

**Why:** Direct database insertion bypasses the normal account-creation normalization. A mixed-case test email produced repeated login failures despite a verified password hash; lowercasing the fixture email allowed the real login form to work.

**How to apply:** Normalize fixture identifiers before insertion. If sign-in fails with a verified hash, check lookup normalization before changing passwords or application authentication.
