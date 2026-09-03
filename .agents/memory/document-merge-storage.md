---
name: Document merge storage
description: Ownership and cleanup rules for AI Tools document merging.
---

Document-merge source uploads must be represented by staff-owned pending records before the API accepts them for merging. Store final PDFs in private object storage and scope every list, view, download, and delete action to the creating staff member. Remove temporary source objects after a successful merge.

**Why:** Direct-to-storage uploads keep file bytes out of the API server, but object paths alone are not an authorization boundary and abandoned source objects create storage leaks.

**How to apply:** Any new document-processing tool should validate ownership from database metadata, stream or download only owned private objects, and define a cleanup policy for temporary inputs.