import { Router, type IRouter, type Request, type Response } from "express";
import { and, asc, eq, inArray } from "drizzle-orm";
import {
  db,
  schoolReportRowsTable,
  schoolReportTermsTable,
  sitesTable,
} from "@workspace/db";
import { calculateReportWeekBeginnings, isValidDateRange } from "../lib/schoolReportDates";

const router: IRouter = Router();
const REPORT_MANAGER_ROLES = new Set(["admin", "educational_leader"]);

function isReportManager(req: Request): boolean {
  return req.session.user?.type === "staff" && REPORT_MANAGER_ROLES.has(req.session.user.role);
}

function requireReportManager(req: Request, res: Response): boolean {
  if (!isReportManager(req)) {
    res.status(403).json({ error: "Admin or Educational Leader access required" });
    return false;
  }
  return true;
}

function parseSiteId(value: unknown): number | null {
  const siteId = Number(value);
  return Number.isInteger(siteId) && siteId > 0 ? siteId : null;
}

function parseTermNumber(value: unknown): number | null {
  const termNumber = Number(value);
  return Number.isInteger(termNumber) && termNumber >= 1 && termNumber <= 4 ? termNumber : null;
}

async function loadSchoolReports(siteId: number) {
  const terms = await db.select().from(schoolReportTermsTable)
    .where(eq(schoolReportTermsTable.siteId, siteId))
    .orderBy(asc(schoolReportTermsTable.termNumber));
  const termIds = terms.map((term) => term.id);
  const rows = termIds.length > 0
    ? await db.select().from(schoolReportRowsTable)
      .where(inArray(schoolReportRowsTable.termId, termIds))
      .orderBy(
        asc(schoolReportRowsTable.weekNumber),
        asc(schoolReportRowsTable.id),
      )
    : [];
  const rowsByTerm = new Map<number, typeof rows>();
  for (const row of rows) {
    const current = rowsByTerm.get(row.termId) ?? [];
    current.push(row);
    rowsByTerm.set(row.termId, current);
  }

  return {
    siteId,
    terms: [1, 2, 3, 4].map((termNumber) => {
      const term = terms.find((candidate) => candidate.termNumber === termNumber);
      if (!term) {
        return {
          id: null,
          siteId,
          termNumber,
          status: "pending" as const,
          termStartDate: null,
          termEndDate: null,
          holidayStartDate: null,
          holidayEndDate: null,
          weekCount: 0,
          generatedAt: null,
          rows: [],
        };
      }
      return {
        ...term,
        status: "open" as const,
        rows: rowsByTerm.get(term.id) ?? [],
      };
    }),
  };
}

router.get("/school-reports", async (req, res): Promise<void> => {
  const siteId = parseSiteId(req.query.siteId);
  const user = req.session.user;
  const isOwnSchool = user?.type === "school" && user.siteId === siteId;
  if (!siteId) {
    res.status(400).json({ error: "A valid siteId is required" });
    return;
  }
  if (!isOwnSchool && !isReportManager(req)) {
    res.status(403).json({ error: "You cannot access school reports for this site" });
    return;
  }

  try {
    const [site] = await db.select({ id: sitesTable.id }).from(sitesTable)
      .where(eq(sitesTable.id, siteId)).limit(1);
    if (!site) {
      res.status(404).json({ error: "Site not found" });
      return;
    }
    res.json(await loadSchoolReports(siteId));
  } catch (error) {
    req.log.error({ error, siteId }, "Failed to load school reports");
    res.status(500).json({ error: "Failed to load school reports" });
  }
});

router.put("/school-reports/:siteId/terms/:termNumber", async (req, res): Promise<void> => {
  if (!requireReportManager(req, res)) return;
  const siteId = parseSiteId(req.params.siteId);
  const termNumber = parseTermNumber(req.params.termNumber);
  if (!siteId || !termNumber) {
    res.status(400).json({ error: "Invalid site or term number" });
    return;
  }

  const termStartDate = String(req.body?.termStartDate ?? "");
  const termEndDate = String(req.body?.termEndDate ?? "");
  const holidayStartDate = req.body?.holidayStartDate ? String(req.body.holidayStartDate) : null;
  const holidayEndDate = req.body?.holidayEndDate ? String(req.body.holidayEndDate) : null;
  if (!isValidDateRange(termStartDate, termEndDate)) {
    res.status(400).json({ error: "Term end date must be on or after the start date" });
    return;
  }
  if (Boolean(holidayStartDate) !== Boolean(holidayEndDate)) {
    res.status(400).json({ error: "Set both holiday program dates or leave both blank" });
    return;
  }
  if (holidayStartDate && holidayEndDate && !isValidDateRange(holidayStartDate, holidayEndDate)) {
    res.status(400).json({ error: "Holiday program end date must be on or after the start date" });
    return;
  }

  const weekBeginnings = calculateReportWeekBeginnings(termStartDate, termEndDate);
  if (weekBeginnings.length === 0 || weekBeginnings.length > 20) {
    res.status(400).json({ error: "Term dates must produce between 1 and 20 weeks" });
    return;
  }

  try {
    const term = await db.transaction(async (tx) => {
      const [saved] = await tx.insert(schoolReportTermsTable).values({
        siteId,
        termNumber,
        termStartDate,
        termEndDate,
        holidayStartDate,
        holidayEndDate,
        weekCount: weekBeginnings.length,
        generatedAt: null,
        generatedById: null,
        updatedAt: new Date(),
      }).onConflictDoUpdate({
        target: [schoolReportTermsTable.siteId, schoolReportTermsTable.termNumber],
        set: {
          termStartDate,
          termEndDate,
          holidayStartDate,
          holidayEndDate,
          weekCount: weekBeginnings.length,
          generatedAt: null,
          generatedById: null,
          updatedAt: new Date(),
        },
      }).returning();
      await tx.delete(schoolReportRowsTable).where(eq(schoolReportRowsTable.termId, saved.id));
      return saved;
    });
    res.json({ ...term, status: "open", rows: [] });
  } catch (error) {
    req.log.error({ error, siteId, termNumber }, "Failed to save school report dates");
    res.status(500).json({ error: "Failed to save report dates" });
  }
});

router.post("/school-reports/:siteId/terms/:termNumber/generate", async (req, res): Promise<void> => {
  if (!requireReportManager(req, res)) return;
  const siteId = parseSiteId(req.params.siteId);
  const termNumber = parseTermNumber(req.params.termNumber);
  if (!siteId || !termNumber) {
    res.status(400).json({ error: "Invalid site or term number" });
    return;
  }

  try {
    const [term] = await db.select().from(schoolReportTermsTable).where(and(
      eq(schoolReportTermsTable.siteId, siteId),
      eq(schoolReportTermsTable.termNumber, termNumber),
    )).limit(1);
    if (!term) {
      res.status(409).json({ error: "Set the term dates before generating this report" });
      return;
    }
    const weekBeginnings = calculateReportWeekBeginnings(term.termStartDate, term.termEndDate);
    if (weekBeginnings.length === 0) {
      res.status(409).json({ error: "The saved term dates do not produce any report weeks" });
      return;
    }
    const holidayWeekBeginnings = term.holidayStartDate && term.holidayEndDate
      ? calculateReportWeekBeginnings(term.holidayStartDate, term.holidayEndDate)
      : [];
    if (holidayWeekBeginnings.length > 20) {
      res.status(409).json({ error: "Holiday program dates must produce no more than 20 weeks" });
      return;
    }

    const generatedAt = new Date();
    const generatedById = req.session.user!.id;
    const rows = [
      ...weekBeginnings.flatMap((weekBeginning, index) =>
      ["BSC", "ASC"].map((serviceType) => ({
        termId: term.id,
        weekNumber: index + 1,
        weekBeginning,
        serviceType,
      })),
      ),
      ...holidayWeekBeginnings.map((weekBeginning, index) => ({
        termId: term.id,
        weekNumber: index + 1,
        weekBeginning,
        serviceType: "VAC",
      })),
    ];

    const generatedRows = await db.transaction(async (tx) => {
      await tx.delete(schoolReportRowsTable).where(eq(schoolReportRowsTable.termId, term.id));
      const inserted = await tx.insert(schoolReportRowsTable).values(rows).returning();
      await tx.update(schoolReportTermsTable).set({
        weekCount: weekBeginnings.length,
        generatedAt,
        generatedById,
        updatedAt: generatedAt,
      }).where(eq(schoolReportTermsTable.id, term.id));
      return inserted;
    });

    res.json({
      ...term,
      weekCount: weekBeginnings.length,
      generatedAt,
      generatedById,
      status: "open",
      rows: generatedRows,
    });
  } catch (error) {
    req.log.error({ error, siteId, termNumber }, "Failed to generate school report");
    res.status(500).json({ error: "Failed to generate school report" });
  }
});

router.put("/school-reports/:siteId/terms/:termNumber/attendance", async (req, res): Promise<void> => {
  if (!requireReportManager(req, res)) return;
  const siteId = parseSiteId(req.params.siteId);
  const termNumber = parseTermNumber(req.params.termNumber);
  if (!siteId || !termNumber) {
    res.status(400).json({ error: "Invalid site or term number" });
    return;
  }

  const inputRows = Array.isArray(req.body?.rows) ? req.body.rows : null;
  if (!inputRows) {
    res.status(400).json({ error: "Attendance rows are required" });
    return;
  }

  const dayFields = ["monday", "tuesday", "wednesday", "thursday", "friday"] as const;
  const pupilFreeFields = [
    "mondayPupilFree",
    "tuesdayPupilFree",
    "wednesdayPupilFree",
    "thursdayPupilFree",
    "fridayPupilFree",
  ] as const;
  const parsedRows: Array<{
    id: number;
    values: Record<(typeof dayFields)[number], string | null> &
      Record<(typeof pupilFreeFields)[number], boolean>;
  }> = [];
  for (const input of inputRows) {
    const id = Number(input?.id);
    if (!Number.isInteger(id) || id < 1) {
      res.status(400).json({ error: "Invalid attendance row" });
      return;
    }
    const values = {} as Record<(typeof dayFields)[number], string | null> &
      Record<(typeof pupilFreeFields)[number], boolean>;
    for (const [index, field] of dayFields.entries()) {
      const value = input?.[field];
      if (value === "" || value === null || typeof value === "undefined") {
        values[field] = null;
      } else if (Number.isInteger(Number(value)) && Number(value) >= 0) {
        values[field] = String(Number(value));
      } else {
        res.status(400).json({ error: "Attendance values must be whole numbers zero or above" });
        return;
      }
      const pupilFreeField = pupilFreeFields[index];
      const pupilFree = input?.[pupilFreeField];
      if (typeof pupilFree === "undefined") {
        values[pupilFreeField] = false;
      } else if (typeof pupilFree === "boolean") {
        values[pupilFreeField] = pupilFree;
      } else {
        res.status(400).json({ error: "Pupil free day values must be boolean" });
        return;
      }
    }
    parsedRows.push({ id, values });
  }

  try {
    const [term] = await db.select().from(schoolReportTermsTable).where(and(
      eq(schoolReportTermsTable.siteId, siteId),
      eq(schoolReportTermsTable.termNumber, termNumber),
    )).limit(1);
    if (!term || !term.generatedAt) {
      res.status(409).json({ error: "Generate this report before entering attendance" });
      return;
    }

    const existingRows = await db.select({
      id: schoolReportRowsTable.id,
      serviceType: schoolReportRowsTable.serviceType,
    })
      .from(schoolReportRowsTable)
      .where(and(
        eq(schoolReportRowsTable.termId, term.id),
        inArray(schoolReportRowsTable.id, parsedRows.map((row) => row.id)),
      ));
    if (existingRows.length !== parsedRows.length) {
      res.status(400).json({ error: "Attendance rows do not belong to this report" });
      return;
    }
    const serviceTypeById = new Map(existingRows.map((row) => [row.id, row.serviceType]));
    if (parsedRows.some((row) =>
      serviceTypeById.get(row.id) === "VAC" &&
      pupilFreeFields.some((field) => row.values[field]),
    )) {
      res.status(400).json({ error: "Pupil free days can only be marked for BSC and ASC sessions" });
      return;
    }

    const savedRows = await db.transaction(async (tx) => {
      for (const row of parsedRows) {
        await tx.update(schoolReportRowsTable).set(row.values)
          .where(and(
            eq(schoolReportRowsTable.id, row.id),
            eq(schoolReportRowsTable.termId, term.id),
          ));
      }
      return tx.select().from(schoolReportRowsTable)
        .where(eq(schoolReportRowsTable.termId, term.id))
        .orderBy(asc(schoolReportRowsTable.weekNumber), asc(schoolReportRowsTable.id));
    });
    res.json({ ...term, status: "open", rows: savedRows });
  } catch (error) {
    req.log.error({ error, siteId, termNumber }, "Failed to save school report attendance");
    res.status(500).json({ error: "Failed to save attendance" });
  }
});

export default router;