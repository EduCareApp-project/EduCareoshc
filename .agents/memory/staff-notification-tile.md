---
name: Staff dashboard Notifications tile
description: Permanent, staff-relevant notification space on the staff dashboards.
---

Consolidate staff notifications, including medication expiry alerts, in the existing dashboard notification space. Keep the tile in place with an empty body when there is nothing to display; do not hide it.

Notifications must be relevant to the signed-in staff member rather than following whichever service they are browsing. Preserve administrator-arranged tile positions.

**Why:** The user noticed the medication expiry tile disappearing when empty and requested one personal notification tile that retains its place.

**How to apply:** Keep this space permanent on Educator and Leadership dashboards, including empty, loading, and error states. Treat an unsuccessful fetch as an error, not an empty inbox.

Show only unacknowledged notifications and provide acknowledgement directly in the tile. Expired medical and qualification issues must recur until resolved. Use daily recurrence in Melbourne time: acknowledgement lasts for the day, rather than being immediately undone by polling. Renewed, removed or archived source records must stop producing overdue alerts. Email reminder frequency is separate and must not increase with dashboard recurrence.

**Why:** The user explicitly requested an unacknowledged-only Educator inbox, acknowledgement buttons, and persistent unresolved expiry reminders. Daily recurrence lets acknowledgement have a useful effect without permanently hiding compliance issues.

**How to apply:** Preserve personal recipient scope; educators receive medical alerts for their own service and qualification alerts for themselves. Do not treat opening an alert's link as explicit acknowledgement in the dashboard tile.
