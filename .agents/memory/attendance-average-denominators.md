---
name: Attendance average denominators
description: Business rule for excluding inactive weeks from school-report attendance averages.
---

Calculate attendance averages independently for each service. If a service has no bookings or records zero attendance for every day of a week, exclude that week from that service’s denominator. Another service that operated during the same week must still include the week in its own average.

Individual zero-attendance days still count when that service recorded attendance elsewhere in the same week.

**Why:** A fully inactive week should not artificially lower average attendance, but a genuine zero day during an otherwise active week remains part of normal operations.

**How to apply:** Use this rule for live service statistics and generated or refreshed school-report statistics. Preserve service-specific handling for BSC, ASC, pupil-free care, and Vacation Care.