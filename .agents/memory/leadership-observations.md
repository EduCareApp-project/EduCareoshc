---
name: Leadership Recent Observations
description: Child service codes and personal collapse behaviour for Leadership Recent Observations.
---

The Leadership Recent Observations Site column should identify the listed child's assigned service using its manually assigned service code, not the observation submitter's service. Do not invent a code where none has been assigned.

**Why:** The user requested automatically pulling the service code for the child listed in each observation. Site identifiers remain manually assigned.

The section's expanded/collapsed choice is personal to the staff account and must survive signing out and back in. It must not change the organisation's shared dashboard layout or other staff members' choices.

**Why:** The user wants their last choice remembered on their next login, while shared layout changes use a separate draft-and-apply workflow.

**How to apply:** Keep account persistence authoritative, make load/save failures visible, and treat collapsed display height separately from saved shared-layout dimensions.
