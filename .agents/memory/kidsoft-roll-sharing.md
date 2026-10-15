---
name: Kidsoft roll sharing
description: Intended source and snapshot behaviour for school-facing Kidsoft rolls.
---

Map the organisation's different Kidsoft services to EduCare services, pull live roll information from Kidsoft, and display it statically in the EduCare school portal.

The feature originally discussed as **Kidsoft Roll** uses **Daily Bookings** as its school-facing tab name.

**Why:** The user resumed the feature and then asked to call the tab Daily Bookings.

Schools need the list of individual children booked in, not just attendance totals. Schools may only see today's bookings, using the Melbourne calendar day; they cannot select or request earlier or future days. Schools themselves must have a Refresh button that pulls the latest live booking data from Kidsoft.

**Why:** The user narrowed the original day-selection request to today only for school accounts and retained school-triggered refresh.

**How to apply:** Treat imported rolls as saved snapshots between refreshes, rather than a live embedded Kidsoft page. Keep each school's access scoped to its mapped service. Do not restrict refresh to staff accounts or substitute actual attendance for booked children.

Daily Bookings must have no calendar or date picker for any viewer, including staff preview. Display and refresh only the current Melbourne day's bookings.

**Why:** The user explicitly requested removing the calendar and limiting this tab to the current day, not merely limiting school logins.

**How to apply:** Keep a read-only today label and Refresh today action; advance the displayed day at Melbourne midnight and determine the current day again when refreshing.

Show Before School Care and After School Care with dark green headings and white writing. Combine casual and regular bookings for each care type, and retain Marked absent badges.

Do not show booking totals, child counts or session count badges anywhere on the school portal Daily Bookings page, including when staff preview it.

**Why:** The user requested removal from the schools view and reported that the role-only change still left counts visible. Treat this as a page-level presentation rule, not a school-login-only rule.

**Why:** The user explicitly requested these two combined groups, the heading colours and the absence indicators.

**How to apply:** Keep source booking and absence details intact while presenting the combined lists. Do not label full-day bookings as before- or after-school care merely to force them into these groups.

Kidsoft bookings are authoritative for this roll; do not match children to EduCare profiles by name or apply EduCare learning-list status filters to the imported roll.

**Why:** The requested roll is the selected Kidsoft service's booked children. Local profile IDs and statuses belong to a separate dataset and could silently exclude valid bookings.

**How to apply:** Map services, resolve the booked child IDs through Kidsoft, and clearly distinguish booking absence flags from actual attendance. Do not create or change EduCare child profiles as part of refreshing a roll.
