---
name: Onboarding staff boundary
description: The durable access and visibility rules for the Onboarding staff role.
---

Onboarding is a profile-only role. An Onboarding account can view its own qualifications but cannot add, upload, edit, archive or delete them, including qualification details on the profile form. It can maintain its own personal details, bio, photo and professional development, but cannot alter its role, status or site assignments, see other staff records, or manage unrelated areas. It must not be treated as an educator or appear in assignment selectors, compliance reports, school-facing staff lists, or unrelated navigation. Managers can still see and manage the profile from the main Staff area. Onboarding profiles have no home or associated sites.

**Why:** This role represents a person whose staff record is being prepared before they receive an operational role. A real Onboarding user needed her own bio and profile controls restored, but the user clarified that qualification uploads must remain manager-controlled. Treating the role as full-access or allowing it into generic active-staff queries would expose unrelated data and make the person look like an active educator prematurely.

**How to apply:** Keep both frontend route/navigation restrictions and a central backend allowlist. Permit personal profile mutations only when the staff ID matches the signed-in user, never permit self-promotion or qualification changes, and enforce the read-only qualification boundary on the API as well as in the UI. Any new staff selector or educator-facing query must explicitly exclude Onboarding unless the feature is part of the person's own profile.