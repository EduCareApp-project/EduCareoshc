---
name: School report snapshots
description: Defines when generated school-report statistics and narrative content may change.
---

Generated Service Statistics are snapshots of selected attendance and holiday-program applicability. If no selected term has an applicable holiday program, omit holiday statistics entirely. Attendance saves automatically refresh affected draft snapshots; finalised snapshots never change. Reporting Obligations remain editable while draft, then both sections lock on finalisation.

**Why:** Draft graphs must reflect attendance entered after the report was first created, while a finalised PDF must remain a stable historical record.

**How to apply:** New outputs, exports, and views read the stored snapshot. Refresh drafts when included-term attendance is saved, and self-heal stale drafts when loaded; never alter a finalised report.