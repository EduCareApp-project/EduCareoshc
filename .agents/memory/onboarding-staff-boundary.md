---
name: Onboarding staff boundary
description: The durable access and visibility rules for the Onboarding staff role.
---

Onboarding is a profile-only role. An Onboarding account can view only its own staff profile and its relevant profile tabs, with no management or mutation controls. It must not be treated as an educator or appear in assignment selectors, compliance reports, school-facing staff lists, or unrelated navigation. Managers can still see and manage the profile from the main Staff area. Onboarding profiles have no home or associated sites.

**Why:** This role represents a person whose staff record is being prepared before they receive an operational role. Treating an unknown role as full-access or allowing it into generic active-staff queries would expose data and make the person look like an active educator prematurely.

**How to apply:** Keep both frontend route/navigation restrictions and a central backend allowlist. Any new staff selector or educator-facing query must explicitly exclude Onboarding unless the feature is part of the person's own profile.