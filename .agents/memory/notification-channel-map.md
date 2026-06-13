---
name: Notification channel map
description: How per-event email/in-app delivery toggling is stored and enforced.
---

# Notification channel map

## Rule
Guardian emails (notices, posts, weekly plan, medication, behavioural) are gated by `isEmailChannelEnabled(key)` from `artifacts/api-server/src/lib/channelMap.ts` before sending. Defaults are in DEFAULTS constant in that file.

## Storage
`feature_settings.notificationChannelMap` JSONB — `Record<string, { email?: boolean; inApp?: boolean }>`.
Updated via the existing `PUT /settings/features` endpoint.

## UI
"Mapping" tab in `settings-notifications.tsx` — 24 events in 3 groups with Email/In-App checkboxes.

**Why:** User needed to stop certain events (notices, posts, medication) from emailing guardian inboxes while keeping in-app only. A single JSONB map per org with sensible defaults (guardian events default email=true, staff events default inApp=true) handles this without a new DB table.

**How to apply:** When adding a new email-sending route for guardians, import `isEmailChannelEnabled` from `../lib/channelMap` and add a guard before the send call. Pick a new event key and add it to DEFAULTS in channelMap.ts plus MAPPING_EVENTS in settings-notifications.tsx.
