import { describe, expect, it } from "vitest";
import { buildEmergencyStatuses } from "./serviceCompliance";

const NOW = new Date("2026-09-02T00:00:00.000Z");

describe("buildEmergencyStatuses", () => {
  it("keeps an expired latest record outstanding until the same service and type is replaced", () => {
    const statuses = buildEmergencyStatuses(
      [
        { id: 1, name: "Aldercourt" },
        { id: 2, name: "Bayview" },
        { id: 3, name: "Central" },
      ],
      [
        {
          siteId: 1,
          drillType: "evacuation",
          conductedAt: "2026-01-01T00:00:00.000Z",
          nextDueAt: "2026-04-01T00:00:00.000Z",
          archivedAt: null,
        },
        {
          siteId: 1,
          drillType: "evacuation",
          conductedAt: "2026-07-22T00:00:00.000Z",
          nextDueAt: "2026-10-20T00:00:00.000Z",
          archivedAt: null,
        },
        {
          siteId: 2,
          drillType: "evacuation",
          conductedAt: "2026-04-01T00:00:00.000Z",
          nextDueAt: "2026-06-30T00:00:00.000Z",
          archivedAt: null,
        },
        {
          siteId: 2,
          drillType: "evacuation",
          conductedAt: "2026-08-01T00:00:00.000Z",
          nextDueAt: "2026-10-30T00:00:00.000Z",
          archivedAt: "2026-08-02T00:00:00.000Z",
        },
        {
          siteId: 2,
          drillType: "lockdown",
          conductedAt: "2025-01-01T00:00:00.000Z",
          nextDueAt: "2026-01-01T00:00:00.000Z",
          archivedAt: null,
        },
      ],
      NOW,
    );

    expect(statuses).toEqual([
      {
        siteId: 1,
        siteName: "Aldercourt",
        drillType: "evacuation",
        status: "current",
        lastConducted: "2026-07-22T00:00:00.000Z",
        nextDue: "2026-10-20T00:00:00.000Z",
      },
      {
        siteId: 2,
        siteName: "Bayview",
        drillType: "evacuation",
        status: "expired",
        lastConducted: "2026-04-01T00:00:00.000Z",
        nextDue: "2026-06-30T00:00:00.000Z",
      },
      {
        siteId: 2,
        siteName: "Bayview",
        drillType: "lockdown",
        status: "expired",
        lastConducted: "2025-01-01T00:00:00.000Z",
        nextDue: "2026-01-01T00:00:00.000Z",
      },
      {
        siteId: 3,
        siteName: "Central",
        drillType: "evacuation",
        status: "missing",
        lastConducted: null,
        nextDue: null,
      },
    ]);
  });

  it("does not let a replacement at another service clear an expired record", () => {
    const statuses = buildEmergencyStatuses(
      [
        { id: 1, name: "Aldercourt" },
        { id: 2, name: "Bayview" },
      ],
      [
        {
          siteId: 1,
          drillType: "evacuation",
          conductedAt: "2026-01-01T00:00:00.000Z",
          nextDueAt: "2026-04-01T00:00:00.000Z",
          archivedAt: null,
        },
        {
          siteId: 2,
          drillType: "evacuation",
          conductedAt: "2026-08-01T00:00:00.000Z",
          nextDueAt: "2026-10-30T00:00:00.000Z",
          archivedAt: null,
        },
      ],
      NOW,
    );

    expect(statuses.map(({ siteId, status }) => ({ siteId, status }))).toEqual([
      { siteId: 1, status: "expired" },
      { siteId: 2, status: "current" },
    ]);
  });
});