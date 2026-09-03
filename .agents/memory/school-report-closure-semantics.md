---
name: School report closure semantics
description: Defines how pupil-free session flags combine into a full-day service closure.
---

A pupil-free-day flag applies to one BSC or ASC session on one weekday. If BSC is flagged and ASC is not, the ASC attendance value is reported as Pupil Free attendance rather than ASC attendance. If both sessions are flagged, the service was closed for that day. VAC rows do not use pupil-free flags.

**Why:** These flags will become source data for future reporting and business logic, so a session closure must remain distinct from a recorded attendance value of zero.

**How to apply:** Preserve the individual flags. Move ASC attendance into the Pupil Free series only for BSC-flagged/ASC-unflagged days, and derive a full-day closure only when both flags are set.