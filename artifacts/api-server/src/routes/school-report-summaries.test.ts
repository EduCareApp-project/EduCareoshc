import { beforeEach, describe, expect, it, vi } from "vitest";
import express from "express";
import request from "supertest";

const { mockDb, queueSelect, writes, mockRefresh, columns } = vi.hoisted(() => {
  const selectResults: unknown[][] = [];
  const writes: Array<{ kind: "insert" | "update"; value: unknown }> = [];

  function query(result: unknown[]) {
    const chain: Record<string, unknown> = {};
    for (const method of ["from", "where", "orderBy", "limit"]) {
      chain[method] = vi.fn(() => chain);
    }
    chain.then = (resolve: (value: unknown[]) => unknown) => Promise.resolve(result).then(resolve);
    return chain;
  }

  function write(kind: "insert" | "update") {
    const chain: Record<string, unknown> = {};
    chain.values = vi.fn((value: unknown) => {
      writes.push({ kind, value });
      return chain;
    });
    chain.set = vi.fn((value: unknown) => {
      writes.push({ kind, value });
      return chain;
    });
    chain.where = vi.fn(() => chain);
    chain.returning = vi.fn(() => query([{
      id: 99,
      ...(writes.at(-1)?.value as Record<string, unknown>),
    }]));
    return chain;
  }

  return {
    columns: {
      id: "id",
      siteId: "siteId",
      reportYear: "reportYear",
      frequency: "frequency",
      period: "period",
      status: "status",
      archivedAt: "archivedAt",
      reportingObligations: "reportingObligations",
      finalizedAt: "finalizedAt",
      createdAt: "createdAt",
      termNumber: "termNumber",
      termId: "termId",
      weekNumber: "weekNumber",
      weekBeginning: "weekBeginning",
      serviceType: "serviceType",
      generatedAt: "generatedAt",
      name: "name",
      logoPath: "logoPath",
    },
    queueSelect: (...results: unknown[][]) => selectResults.push(...results),
    writes,
    mockRefresh: vi.fn(),
    mockDb: {
      select: vi.fn(() => query(selectResults.shift() ?? [])),
      insert: vi.fn(() => write("insert")),
      update: vi.fn(() => write("update")),
    },
  };
});

vi.mock("@workspace/db", () => ({
  db: mockDb,
  schoolReportSummariesTable: columns,
  schoolReportTermsTable: columns,
  schoolReportRowsTable: columns,
  sitesTable: columns,
  organisationTable: columns,
  emailSettingsTable: columns,
}));

vi.mock("../lib/refreshDraftSchoolReportSummaries", () => ({
  refreshDraftSchoolReportSummaries: mockRefresh,
}));

vi.mock("../lib/objectStorage", () => ({
  ObjectNotFoundError: class ObjectNotFoundError extends Error {},
  ObjectStorageService: class ObjectStorageService {},
}));

import schoolReportSummariesRouter from "./school-report-summaries";

const obligations = {
  learningPlayProgramHighlights: "Learning text",
  teamServiceLeadership: "Leadership text",
  policyPracticeUpdates: "Policy text",
  childSafetyWellbeing: "Safety text",
  communityFeedbackResolution: "Community text",
  focusForFuture: "Future text",
};

const archived = {
  id: 7,
  siteId: 4,
  reportYear: 2026,
  frequency: "term",
  period: "1",
  periodLabel: "Term 1 2026",
  status: "finalized",
  archivedAt: new Date("2026-05-01T00:00:00Z"),
  reportingObligations: obligations,
  pdfPath: "generated/school-reports/original.pdf",
  pdfName: "Original.pdf",
};

function app() {
  const instance = express();
  instance.use(express.json());
  instance.use((req, _res, next) => {
    req.session = {
      user: { id: 12, type: "staff", role: "admin" },
    } as typeof req.session;
    next();
  });
  instance.use("/api", schoolReportSummariesRouter);
  return instance;
}

function term(termNumber = 1) {
  return {
    id: 21,
    siteId: 4,
    reportYear: 2026,
    termNumber,
    termStartDate: "2026-01-27",
    termEndDate: "2026-04-02",
    holidayProgramApplies: false,
    generatedAt: new Date(),
  };
}

function row(monday: string) {
  return {
    id: 31,
    termId: 21,
    weekNumber: 1,
    weekBeginning: "2026-01-26",
    serviceType: "BSC",
    monday,
    tuesday: "0",
    wednesday: "0",
    thursday: "0",
    friday: "0",
    mondayPupilFree: false,
    tuesdayPupilFree: false,
    wednesdayPupilFree: false,
    thursdayPupilFree: false,
    fridayPupilFree: false,
  };
}

describe("school report replacement text preservation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    writes.length = 0;
  });

  it("copies every obligation into a replacement while recalculating current attendance", async () => {
    const archivedSnapshot = structuredClone(archived);
    queueSelect([term()], [row("25")], [], [archived]);

    const response = await request(app())
      .post("/api/school-reports/4/summaries")
      .send({ reportYear: 2026, frequency: "term", period: "1" });

    expect(response.status).toBe(201);
    const inserted = writes.find((write) => write.kind === "insert")?.value as Record<string, unknown>;
    expect(inserted.reportingObligations).toEqual(obligations);
    const statistics = inserted.statistics as {
      weekdayAverages: Array<{ day: string; bsc: number }>;
      weeklyAverages: Array<{ label: string; bsc: number }>;
    };
    expect(statistics.weekdayAverages[0]).toMatchObject({ day: "Monday", bsc: 25 });
    expect(statistics.weeklyAverages[0]).toMatchObject({ label: "Week 1", bsc: 5 });
    expect(archived).toEqual(archivedSnapshot);
    expect(writes).toHaveLength(1);
  });

  it("carries every obligation into the next reporting period", async () => {
    const previousPeriod = {
      ...archived,
      period: "1",
      periodLabel: "Term 1 2026",
      archivedAt: null,
      finalizedAt: new Date("2026-04-01T00:00:00Z"),
    };
    queueSelect([term(2)], [row("30")], [], [previousPeriod]);

    const response = await request(app())
      .post("/api/school-reports/4/summaries")
      .send({ reportYear: 2026, frequency: "term", period: "2" });

    expect(response.status).toBe(201);
    const inserted = writes.find((write) => write.kind === "insert")?.value as Record<string, unknown>;
    expect(inserted.reportingObligations).toEqual(obligations);
    expect(inserted.period).toBe("2");
    const statistics = inserted.statistics as {
      weekdayAverages: Array<{ day: string; bsc: number }>;
    };
    expect(statistics.weekdayAverages[0]).toMatchObject({ day: "Monday", bsc: 30 });
  });

  it("regenerates an existing draft without overwriting its edited text", async () => {
    const edited = { ...obligations, focusForFuture: "Edited replacement text" };
    queueSelect([term()], [row("40")], [{
      ...archived,
      id: 8,
      status: "draft",
      archivedAt: null,
      reportingObligations: edited,
    }]);

    const response = await request(app())
      .post("/api/school-reports/4/summaries")
      .send({ reportYear: 2026, frequency: "term", period: "1" });

    expect(response.status).toBe(200);
    expect(mockDb.select).toHaveBeenCalledTimes(3);
    const update = writes[0].value as Record<string, unknown>;
    expect(update).not.toHaveProperty("reportingObligations");
    const statistics = update.statistics as {
      weekdayAverages: Array<{ day: string; bsc: number }>;
    };
    expect(statistics.weekdayAverages[0]).toMatchObject({ day: "Monday", bsc: 40 });
  });

  it("repairs a legacy empty draft from the latest matching archive without changing the archive", async () => {
    const olderObligations = { ...obligations, focusForFuture: "Older archived text" };
    const olderArchive = {
      ...archived,
      id: 6,
      archivedAt: new Date("2026-04-01T00:00:00Z"),
      reportingObligations: olderObligations,
    };
    const legacy = {
      ...archived,
      id: 9,
      status: "draft",
      archivedAt: null,
      reportingObligations: Object.fromEntries(Object.keys(obligations).map((key) => [key, ""])),
      statistics: { termNumbers: [1] },
    };
    const archivedSnapshot = structuredClone(archived);
    queueSelect([legacy, olderArchive, archived]);

    const response = await request(app())
      .get("/api/school-reports/4/summaries?reportYear=2026");

    expect(response.status).toBe(200);
    expect(response.body[0].reportingObligations).toEqual(obligations);
    expect((writes[0].value as Record<string, unknown>).reportingObligations).toEqual(obligations);
    expect(archived).toEqual(archivedSnapshot);
    expect(archived.pdfPath).toBe("generated/school-reports/original.pdf");
  });
});