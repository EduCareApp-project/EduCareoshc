---
name: Service start-date compliance
description: Actual opening dates govern roll eligibility, independently of when a site is added to the portal
---

Roll compliance should use the service’s actual start date, not the date its site record was created in the portal. Do not infer or backfill opening dates for existing services.

**Why:** The user reported that new services appeared non-compliant for previous weeks and requested recognition of their service start date. Established services may have operated before they were entered into the portal.

**How to apply:** Include the week containing the opening date and later weeks; exclude earlier weeks from both weekly roll lists and compliance denominators. Leave existing historical eligibility unchanged when no start date is supplied. Preserve saved historical submissions rather than deleting them when eligibility changes.

Use calendar-only YYYY-MM-DD strings across storage and API contracts for these dates.

**Why:** This workspace’s generator coerces OpenAPI `format: date` fields into JavaScript dates in Zod. Start dates need to remain calendar dates, without time-zone conversion.

**How to apply:** Keep date-only database mode and string contracts consistent; validate the actual calendar date as well as its shape.
