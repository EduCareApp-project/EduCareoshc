---
name: Onboarding staff boundary
description: The durable access and visibility rules for the Onboarding staff role.
---

Onboarding is a profile-only role. An Onboarding account can view and maintain its own staff profile, including bio, photo, qualifications and professional development, but cannot alter its role, status or site assignments, see other staff records, or manage unrelated areas. It must not be treated as an educator or appear in assignment selectors, compliance reports, school-facing staff lists, or unrelated navigation. Managers can still see and manage the profile from the main Staff area. Onboarding profiles have no home or associated sites.

**Why:** This role represents a person whose staff record is being prepared before they receive an operational role. The original read-only interpretation was too restrictive: a real Onboarding user reported she could not edit her bio or maintain her own qualifications. Treating the role as full-access or allowing it into generic active-staff queries would expose unrelated data and make the person look like an active educator prematurely.

**How to apply:** Keep both frontend route/navigation restrictions and a central backend allowlist. Permit profile mutations only when the staff ID or record ownership matches the signed-in user, and never permit self-promotion. Any new staff selector or educator-facing query must explicitly exclude Onboarding unless the feature is part of the person's own profile.