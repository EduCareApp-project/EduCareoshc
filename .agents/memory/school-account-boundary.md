---
name: School account boundary
description: Durable identity and authorization rules for school portal accounts.
---

Each Site owns one school account whose initial username is generated from the site name. Administrators may replace the username and set or reset its password from Systems Access or the school tile. A school session is read-only and may access only its own site data.

Staff keep one primary Home Site and may also have multiple Associated Sites. A school's staff list includes active staff whose Home Site is that school or who explicitly list it as an Associated Site; Home Site must not be duplicated in the association list.

Every newly created school vital record requires a supporting document. Store the file privately, expose it through a site-scoped school endpoint, and remove the stored object when the record is deleted.

**Why:** School users must never inherit the broad API access available to staff sessions or select another site's data, including documents attached to compliance records.

**How to apply:** New school-facing features must derive site scope from the authenticated school session, enforce restrictions in the API rather than only the UI, and use both Home Site and Associated Sites when resolving school staff. Portal tabs and qualification types are organisation-configurable; disabled staff records must be filtered before response, and private staff files require Site-, association-, record-, and visibility-scoped download routes.