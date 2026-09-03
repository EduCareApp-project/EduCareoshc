---
name: School report closure semantics
description: Defines how pupil-free session flags combine into a full-day service closure.
---

A pupil-free-day flag applies to one BSC or ASC session on one weekday. If both the BSC and ASC sessions are flagged for the same week and weekday, the service was closed for that day. VAC rows do not use pupil-free flags.

**Why:** These flags will become source data for future reporting and business logic, so a session closure must remain distinct from a recorded attendance value of zero.

**How to apply:** Preserve the individual BSC and ASC flags in future report calculations. Derive a full-day service closure only when both flags match the same report week and weekday.