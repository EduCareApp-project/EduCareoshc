import { beforeEach, describe, expect, it, vi } from "vitest";
import express from "express";
import request from "supertest";

const { mockDb, queueSelect, writes, mockRefresh, columns, mockPdf, mockGetObject, mockDownloadObject, mockSaveObject, mockLog } = vi.hoisted(() => {
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
      companyLogoPath: "companyLogoPath",
    },
    queueSelect: (...results: unknown[][]) => selectResults.push(...results),
    writes,
    mockRefresh: vi.fn(),
    mockPdf: vi.fn(),
    mockGetObject: vi.fn(),
    mockDownloadObject: vi.fn(),
    mockSaveObject: vi.fn(),
    mockLog: vi.fn(),
    mockDb: {
      select: vi.fn(() => query(selectResults.shift() ?? [])),
      insert: vi.fn(() => write("insert")),
      update: vi.fn(() => write("update")),
    },
  };
});

vi.mock("@workspace/db", () => ({
  currentOrganisationId: () => 1,
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
  ObjectStorageService: class ObjectStorageService {
    getObjectEntityFile = mockGetObject;
    downloadObject = mockDownloadObject;
    saveObjectEntity = mockSaveObject;
  },
}));
vi.mock("../lib/schoolReportPdf", () => ({ createSchoolReportPdf: mockPdf }));

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

function app(user: { id: number; type: "staff" | "school" | "guardian"; role?: string; siteId?: number } = {
  id: 12, type: "staff", role: "admin",
}) {
  const instance = express();
  instance.use(express.json());
  instance.use((req, _res, next) => {
    req.session = {
      user,
    } as typeof req.session;
    req.log = { error: mockLog } as unknown as typeof req.log;
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

describe("school report PDF branding sources", () => {
  const draft = { ...archived, archivedAt: null, status: "draft" };
  beforeEach(() => {
    vi.clearAllMocks();
    writes.length = 0;
    mockPdf.mockResolvedValue(new Uint8Array([37, 80, 68, 70]));
    mockGetObject.mockImplementation(async (path: string) => path);
    mockDownloadObject.mockImplementation(async (path: string) => new Response(
      new Uint8Array(path.includes("email-logo") ? [10, 20, 30] : [40, 50, 60]),
    ));
    mockSaveObject.mockResolvedValue("/objects/generated/school-reports/new-pdf");
  });
  function queueDraftWithLogos() {
    queueSelect([draft], [{ name: "School" }], [{ name: "Company" }], [{
      logoPath: "/objects/email-logo", companyLogoPath: "/objects/company-logo",
    }]);
  }
  it("pulls the Global Settings email logo and Brand Kit company logo into the newly stored PDF", async () => {
    queueDraftWithLogos();
    const response = await request(app()).post("/api/school-reports/4/summaries/7/finalize");
    expect(response.status).toBe(200);
    expect(mockDb.select).toHaveBeenLastCalledWith({ logoPath: columns.logoPath, companyLogoPath: columns.companyLogoPath });
    expect(mockGetObject).toHaveBeenCalledWith("/objects/email-logo");
    expect(mockGetObject).toHaveBeenCalledWith("/objects/company-logo");
    expect(mockPdf).toHaveBeenCalledWith(draft, "School", "Company", {
      emailLogoBytes: new Uint8Array([10, 20, 30]),
      companyLogoBytes: new Uint8Array([40, 50, 60]),
    });
    expect(mockSaveObject).toHaveBeenCalledWith(expect.any(Uint8Array), "application/pdf", "generated/school-reports");
    expect(response.body.finalizedPdfName).toBe("Company - School - Term 1 Report - 2026.pdf");
  });
  it("does not finalise or save an incomplete report when a configured logo cannot be downloaded", async () => {
    queueDraftWithLogos();
    mockDownloadObject.mockResolvedValueOnce(new Response("Missing logo", { status: 404 }));
    const response = await request(app()).post("/api/school-reports/4/summaries/7/finalize");
    expect(response.status).toBe(500);
    expect(mockPdf).not.toHaveBeenCalled();
    expect(mockSaveObject).not.toHaveBeenCalled();
    expect(writes).toHaveLength(0);
  });
  it("does not finalise or save when a configured image cannot be rendered", async () => {
    queueDraftWithLogos();
    mockPdf.mockRejectedValueOnce(new Error("Unsupported image"));
    expect((await request(app()).post("/api/school-reports/4/summaries/7/finalize")).status).toBe(500);
    expect(mockSaveObject).not.toHaveBeenCalled();
    expect(writes).toHaveLength(0);
  });
  it("preserves a previously finalised PDF instead of regenerating it using changed logos", async () => {
    const saved = { ...archived, archivedAt: null, finalizedPdfPath: "/objects/original-pdf", finalizedPdfName: "Original.pdf" };
    queueSelect([saved]);
    const response = await request(app()).post("/api/school-reports/4/summaries/7/finalize");
    expect(response.status).toBe(200);
    expect(response.body.finalizedPdfPath).toBe("/objects/original-pdf");
    expect(mockDb.select).toHaveBeenCalledTimes(1);
    expect(mockPdf).not.toHaveBeenCalled();
    expect(mockGetObject).not.toHaveBeenCalled();
    expect(mockSaveObject).not.toHaveBeenCalled();
    expect(writes).toHaveLength(0);
  });
  it("previews the current unsaved text with both configured logos without saving or finalising", async () => {
    queueDraftWithLogos();
    const original = structuredClone(draft);
    const currentText = { ...obligations, learningPlayProgramHighlights: "Current unsaved editor text" };
    const response = await request(app()).post("/api/school-reports/4/summaries/7/preview").send({
      reportingObligations: currentText,
      status: "finalized",
      statistics: { fake: true },
    });
    expect(response.status).toBe(200);
    expect(response.headers["content-type"]).toMatch(/^application\/pdf/);
    expect(response.headers["cache-control"]).toBe("no-store");
    expect(response.headers["content-disposition"]).toContain('inline; filename="Preview - Company - School - Term 1 Report - 2026.pdf"');
    expect(response.body).toEqual(Buffer.from([37, 80, 68, 70]));
    expect(mockPdf).toHaveBeenCalledWith({ ...draft, reportingObligations: currentText }, "School", "Company", {
      emailLogoBytes: new Uint8Array([10, 20, 30]), companyLogoBytes: new Uint8Array([40, 50, 60]),
    });
    expect(draft).toEqual(original);
    expect(mockSaveObject).not.toHaveBeenCalled();
    expect(mockRefresh).not.toHaveBeenCalled();
    expect(writes).toHaveLength(0);
  });
  it.each(["admin", "admin_support", "educational_leader"])("allows %s to preview", async (role) => {
    queueDraftWithLogos();
    expect((await request(app({ id: 12, type: "staff", role }))
      .post("/api/school-reports/4/summaries/7/preview").send({ reportingObligations: obligations })).status).toBe(200);
    expect(writes).toHaveLength(0);
    expect(mockSaveObject).not.toHaveBeenCalled();
  });
  it.each([
    { id: 2, type: "school" as const, siteId: 4 },
    { id: 3, type: "guardian" as const },
    { id: 4, type: "staff" as const, role: "educator" },
  ])("rejects preview access for $type $role without reading or writing data", async (user) => {
    expect((await request(app(user)).post("/api/school-reports/4/summaries/7/preview")
      .send({ reportingObligations: obligations })).status).toBe(403);
    expect(mockDb.select).not.toHaveBeenCalled();
    expect(mockPdf).not.toHaveBeenCalled();
    expect(writes).toHaveLength(0);
  });
  it.each([
    {},
    { reportingObligations: {} },
    { reportingObligations: { ...obligations, focusForFuture: 2 } },
    { reportingObligations: { ...obligations, focusForFuture: "x".repeat(20_001) } },
  ])("rejects invalid preview text without reading or writing data", async (body) => {
    expect((await request(app()).post("/api/school-reports/4/summaries/7/preview").send(body)).status).toBe(400);
    expect(mockDb.select).not.toHaveBeenCalled();
    expect(writes).toHaveLength(0);
  });
  it("supports an empty draft narrative", async () => {
    queueDraftWithLogos();
    const blank = Object.fromEntries(Object.keys(obligations).map((key) => [key, ""]));
    expect((await request(app()).post("/api/school-reports/4/summaries/7/preview")
      .send({ reportingObligations: blank })).status).toBe(200);
    expect(writes).toHaveLength(0);
  });
  it.each([
    { ...draft, status: "finalized" },
    { ...draft, archivedAt: new Date() },
  ])("does not regenerate a finalised or archived report for preview", async (report) => {
    queueSelect([report]);
    expect((await request(app()).post("/api/school-reports/4/summaries/7/preview")
      .send({ reportingObligations: obligations })).status).toBe(409);
    expect(mockPdf).not.toHaveBeenCalled();
    expect(mockSaveObject).not.toHaveBeenCalled();
    expect(writes).toHaveLength(0);
  });
  it("returns a missing-report error without generating or saving a preview", async () => {
    queueSelect([]);
    expect((await request(app()).post("/api/school-reports/4/summaries/7/preview")
      .send({ reportingObligations: obligations })).status).toBe(404);
    expect(mockPdf).not.toHaveBeenCalled();
    expect(writes).toHaveLength(0);
  });
  it("fails safely when a logo is unavailable", async () => {
    queueDraftWithLogos();
    mockDownloadObject.mockResolvedValueOnce(new Response("Unavailable", { status: 503 }));
    expect((await request(app()).post("/api/school-reports/4/summaries/7/preview")
      .send({ reportingObligations: obligations })).status).toBe(500);
    expect(mockPdf).not.toHaveBeenCalled();
    expect(mockSaveObject).not.toHaveBeenCalled();
    expect(writes).toHaveLength(0);
  });
});