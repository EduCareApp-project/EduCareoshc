---
name: PDF splitting scope
description: User requirements and processing boundary for the Split PDF tool
---

Split PDF belongs alongside the portal's AI Tools. The user requested a thumbnail of every page, dotted boundaries that turn green when selected, unlimited splits, and multiple downloadable PDFs.

**Why:** The user explicitly described a visual page-boundary workflow, not text-based page range entry or AI-selected split points.

**How to apply:** Do not impose an arbitrary split-count cap; every boundary may be selected, resulting in one PDF per page.

Keep this immediate-download workflow in the browser unless the user asks for shared or persistent document history.

**Why:** Splitting does not need AI or server processing. Local processing avoids uploading potentially sensitive care documents and requires no permanent source or result storage.

**How to apply:** Do not automatically give Split PDF the server-backed history/storage behaviour of Document Merge. Explain that the user downloads the results from the current tool session.