---
name: Kidsoft roll sharing
description: Intended source and snapshot behaviour for school-facing Kidsoft rolls.
---

Map the organisation's different Kidsoft services to EduCare services, pull live roll information from Kidsoft, and display it statically in the EduCare school portal.

The user calls this feature **Kidsoft Roll**.

**Why:** The user supplied this name for returning to the feature; the previous instruction to pause it no longer applies.

Schools need the list of individual children booked in, not just attendance totals. Display one selected day at a time. Schools themselves must have a Refresh button that pulls the latest live booking data from Kidsoft.

**Why:** The user explicitly clarified that schools should see booked children for one day and be able to refresh the data themselves.

**How to apply:** Treat imported rolls as saved snapshots between refreshes, rather than a live embedded Kidsoft page. Keep each school's access scoped to its mapped service. Do not restrict refresh to staff accounts or substitute actual attendance for booked children.
