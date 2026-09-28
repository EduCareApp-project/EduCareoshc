---
name: Excursion reminder undo
description: The user-visible meaning of removing and restoring an excursion reminder.
---

Removing a sent excursion's reminder is not just a notification toggle: it also hides that recipient's excursion from the guardian portal and excludes them from future reminders. Undo must restore guardian visibility and the in-app notification together. It must not send another email automatically. For a completed excursion, Undo can clear the hidden state but should not create a new permission-required notification, since completed excursions are closed to guardians.

**Why:** The original remove action deletes the recipient's notification and hides their assignment; changing only the button text would leave the guardian unable to access the excursion. An email already delivered cannot be recalled, and sending another automatically on Undo would be surprising.

**How to apply:** Keep removal and restoration transactional and preserve the notification's deduplication identity. Derive the action label from persisted recipient visibility so it remains correct after navigation, reload, or another staff member's change.