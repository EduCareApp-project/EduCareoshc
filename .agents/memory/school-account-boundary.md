---
name: School account boundary
description: Durable identity and authorization rules for school portal accounts.
---

Each Site owns one school account whose initial username is generated from the site name. Administrators may replace the username and set or reset its password from Systems Access or the school tile. A school session is read-only and may access only its own site data.

Staff keep one primary Home Site and may also have multiple Associated Sites. A school's staff list includes active staff whose Home Site is that school or who explicitly list it as an Associated Site; Home Site must not be duplicated in the association list.

Every newly created school vital record requires a supporting document. Store the file privately, expose it through a site-scoped school endpoint, and remove the stored object when the record is deleted.

**Why:** School users must never inherit the broad API access available to staff sessions or select another site's data, including documents attached to compliance records.

**How to apply:** New school-facing features must derive site scope from the authenticated school session, enforce restrictions in the API rather than only the UI, and use both Home Site and Associated Sites when resolving school staff. Portal tabs and qualification types are organisation-configurable; disabled staff records must be filtered before response, and private staff files require Site-, association-, record-, and visibility-scoped download routes.

Reports is the first school-portal tab and the default landing content after a school account signs in.

**Why:** The user explicitly requested Reports first and as the school login landing page.

**How to apply:** Prefer Reports when it is enabled, retaining the organisation's visibility restrictions and the order of the other displayed tabs. Do not change staff, guardian or Super Admin login destinations.

Schools must not see staff members' home-service or associated-service locations in Service Staff cards or profiles. Internal staff/admin views retain that information.

**Why:** The user explicitly requested removing staff location information from the school-facing Service Staff view.

**How to apply:** Hide locations in the school UI and omit location fields from school-facing staff responses, without changing which staff are eligible through Home Site or Associated Site assignments.