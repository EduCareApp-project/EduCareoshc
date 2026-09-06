---
name: Finalised school report PDFs
description: Defines persistence and naming rules for finalised school report documents.
---

Finalising a school report must preserve its Reporting Obligations and save one immutable PDF in private object storage. The filename follows `Organisation - Service - Report Type - Year.pdf`.

**Why:** Finalised reports are historical records that may need to be reviewed, archived, or used as the basis for a corrected replacement without losing the original narrative or document.

**How to apply:** Do not regenerate a stored finalised PDF from later data changes. Archived reports retain their saved narrative and PDF; a replacement is a separate editable record that carries forward the latest archived narrative while recalculating only attendance statistics. Never overwrite text already edited in the replacement draft.