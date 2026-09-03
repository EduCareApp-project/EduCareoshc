---
name: School account boundary
description: Durable identity and authorization rules for school portal accounts.
---

Each Site owns one school account whose initial username is generated from the site name. Administrators may replace the username and set or reset its password only through Systems Access. A school session is read-only and may access only the portal aggregate for its own site.

Staff keep one primary Home Site and may also have multiple Associated Sites. A school's staff list includes active staff whose Home Site is that school or who explicitly list it as an Associated Site; Home Site must not be duplicated in the association list.

**Why:** Systems Access must remain the single control plane, while school users must never inherit the broad API access available to staff sessions or select another site's data.

**How to apply:** New school-facing features must derive site scope from the authenticated school session, enforce the restriction in the API rather than only the UI, keep account controls in Systems Access, and use both Home Site and Associated Sites when resolving school staff.