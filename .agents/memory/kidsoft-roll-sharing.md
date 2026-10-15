---
name: Kidsoft roll sharing
description: Intended source and snapshot behaviour for school-facing Kidsoft rolls.
---

Map the organisation's different Kidsoft services to EduCare services, pull live roll information from Kidsoft, and display it statically in the EduCare school portal.

The feature originally discussed as **Kidsoft Roll** uses **Daily Bookings** as its school-facing tab name.

**Why:** The user resumed the feature and then asked to call the tab Daily Bookings.

Schools need the list of individual children booked in, not just attendance totals. Display one selected day at a time. Schools themselves must have a Refresh button that pulls the latest live booking data from Kidsoft.

**Why:** The user explicitly clarified that schools should see booked children for one day and be able to refresh the data themselves.

**How to apply:** Treat imported rolls as saved snapshots between refreshes, rather than a live embedded Kidsoft page. Keep each school's access scoped to its mapped service. Do not restrict refresh to staff accounts or substitute actual attendance for booked children.

Kidsoft bookings are authoritative for this roll; do not match children to EduCare profiles by name or apply EduCare learning-list status filters to the imported roll.

**Why:** The requested roll is the selected Kidsoft service's booked children. Local profile IDs and statuses belong to a separate dataset and could silently exclude valid bookings.

**How to apply:** Map services, resolve the booked child IDs through Kidsoft, and clearly distinguish booking absence flags from actual attendance. Do not create or change EduCare child profiles as part of refreshing a roll.
