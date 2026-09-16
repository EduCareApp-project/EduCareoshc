import { Router, type IRouter, type Request, type Response } from "express";
import { and, asc, desc, eq, isNull } from "drizzle-orm";
import {
  db,
  childrenTable,
  parentAccountsTable,
  excursionsTable,
  excursionRecipientsTable,
  excursionResponseLogsTable,
  excursionRiskAssessmentUploadsTable,
  guardianNotificationsTable,
} from "@workspace/db";
import {
  CreateExcursionBody,
  UpdateExcursionBody,
  UpdateExcursionParams,
  GetExcursionParams,
  AddExcursionRecipientsBody,
  SendExcursionBody,
  VerifyExcursionRecipientsBody,
  SubmitGuardianExcursionDecisionBody,
  ListExcursionsResponse,
  VerifyExcursionRecipientsResponse,
  ListExcursionsResponseItem,
  GetExcursionResponse,
  UpdateExcursionResponse,
  AddExcursionRecipientsResponse,
  SendExcursionResponse,
  ListGuardianExcursionsResponse,
  GetGuardianExcursionResponse,
  MarkGuardianExcursionViewedResponse,
  AcknowledgeGuardianExcursionResponse,
  SubmitGuardianExcursionDecisionResponse,
  ListGuardianNotificationsResponse,
  RequestExcursionRiskAssessmentUploadUrlBody,
  RequestExcursionRiskAssessmentUploadUrlResponse,
} from "@workspace/api-zod";
import { ObjectStorageService, ObjectNotFoundError } from "../lib/objectStorage";
import { Readable } from "stream";
import { sendGuardianExcursionEmail } from "../lib/email";
import { getEmailBranding } from "../lib/emailBranding";
import { isEmailChannelEnabled } from "../lib/channelMap";
import { getAppUrl } from "../lib/appUrl";

const router: IRouter = Router();
const STAFF_ROLES = new Set(["admin", "admin_support", "educational_leader"]);
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const objectStorageService = new ObjectStorageService();

function hasValidRiskAssessmentPath(path: string | null | undefined): boolean {
  return path == null || /^\/objects\/excursions\/[0-9a-f-]+$/i.test(path);
}

router.post("/excursions/risk-assessments/uploads/request-url", async (req, res): Promise<void> => {
  if (!requireStaff(req, res)) return;
  const parsed = RequestExcursionRiskAssessmentUploadUrlBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Missing or invalid required fields" });
    return;
  }
  if (!canStaffAccessSite(req, parsed.data.siteId)) {
    res.status(403).json({ error: "You do not have access to this site" });
    return;
  }
  if (
    parsed.data.contentType !== "application/pdf" ||
    !parsed.data.name.toLowerCase().endsWith(".pdf") ||
    parsed.data.size > 20 * 1024 * 1024
  ) {
    res.status(400).json({ error: "Risk assessments must be PDF files no larger than 20 MB" });
    return;
  }
  try {
    const uploadURL = await objectStorageService.getObjectEntityUploadURL("excursions");
    const objectPath = objectStorageService.normalizeObjectEntityPath(uploadURL);
    if (!hasValidRiskAssessmentPath(objectPath)) {
      res.status(500).json({ error: "Storage returned an invalid risk assessment path" });
      return;
    }
    await db.insert(excursionRiskAssessmentUploadsTable).values({
      objectPath,
      siteId: parsed.data.siteId,
      uploadedByStaffId: req.session.user!.id,
    });
    res.json(RequestExcursionRiskAssessmentUploadUrlResponse.parse({
      uploadURL,
      objectPath,
      metadata: parsed.data,
    }));
  } catch (err) {
    req.log.error({ err }, "Failed to generate excursion risk assessment upload URL");
    res.status(500).json({ error: "Failed to generate upload URL" });
  }
});

function isStaff(req: Request): boolean {
  return req.session.user?.type === "staff" && STAFF_ROLES.has(req.session.user.role);
}

function requireStaff(req: Request, res: Response): boolean {
  const user = req.session.user;
  if (!isStaff(req) || (user?.role === "educational_leader" && user.siteId == null)) {
    res.status(403).json({ error: "Excursion staff access requires an educational leader site assignment" });
    return false;
  }
  return true;
}

function requireGuardian(req: Request, res: Response): boolean {
  if (req.session.user?.type !== "guardian") {
    res.status(403).json({ error: "Guardian access required" });
    return false;
  }
  return true;
}

function canStaffAccessSite(req: Request, siteId: number): boolean {
  const user = req.session.user;
  return isStaff(req) && (
    user?.role === "admin" ||
    user?.role === "admin_support" ||
    user?.siteId === siteId
  );
}

class RiskAssessmentProvenanceError extends Error {
  constructor(readonly status: 400 | 403 | 409, message: string) {
    super(message);
    this.name = "RiskAssessmentProvenanceError";
  }
}

async function validateRiskAssessmentUpload(
  executor: typeof db,
  objectPath: string,
  staffId: number,
  siteId: number,
  excursionId: number | null,
) {
  const [upload] = await executor.select().from(excursionRiskAssessmentUploadsTable)
    .where(eq(excursionRiskAssessmentUploadsTable.objectPath, objectPath));
  if (!upload) {
    throw new RiskAssessmentProvenanceError(400, "Risk assessment upload was not issued by the server");
  }
  if (upload.uploadedByStaffId !== staffId) {
    throw new RiskAssessmentProvenanceError(403, "Risk assessment upload belongs to another staff member");
  }
  if (upload.siteId !== siteId) {
    throw new RiskAssessmentProvenanceError(403, "Risk assessment upload belongs to another site");
  }
  if (upload.claimedExcursionId !== null && upload.claimedExcursionId !== excursionId) {
    throw new RiskAssessmentProvenanceError(409, "Risk assessment upload has already been claimed");
  }
  return upload;
}

async function claimRiskAssessmentUpload(
  executor: typeof db,
  uploadId: number,
  excursionId: number,
) {
  const [claimed] = await executor.update(excursionRiskAssessmentUploadsTable)
    .set({ claimedExcursionId: excursionId })
    .where(and(
      eq(excursionRiskAssessmentUploadsTable.id, uploadId),
      isNull(excursionRiskAssessmentUploadsTable.claimedExcursionId),
    ))
    .returning();
  if (!claimed) {
    const [alreadyClaimed] = await executor.select({ claimedExcursionId: excursionRiskAssessmentUploadsTable.claimedExcursionId })
      .from(excursionRiskAssessmentUploadsTable)
      .where(eq(excursionRiskAssessmentUploadsTable.id, uploadId));
    if (alreadyClaimed?.claimedExcursionId === excursionId) return;
    throw new RiskAssessmentProvenanceError(409, "Risk assessment upload has already been claimed");
  }
}

function idParam(value: unknown): number | null {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

function dateOnly(value: Date | string): string {
  return value instanceof Date ? value.toISOString().slice(0, 10) : value;
}

function normaliseEmails(emails: string[]): string[] {
  return [...new Set(emails.map((email) => email.trim().toLowerCase()).filter((email) => email.length > 0))];
}

type VerifiedAssignment = {
  guardianEmail: string;
  guardianId: number;
  guardianName: string;
  childId: number;
  childName: string;
};

async function verifyAssignments(_siteId: number, inputEmails: string[]): Promise<{
  results: Array<{
    email: string;
    valid: boolean;
    guardianName: string | null;
    children: Array<{ childId: number; childName: string; siteId: number }>;
  }>;
  assignments: VerifiedAssignment[];
}> {
  const emails = normaliseEmails(inputEmails);
  const [children, accounts] = await Promise.all([
    db.select().from(childrenTable).where(eq(childrenTable.status, "active")),
    db.select().from(parentAccountsTable),
  ]);
  const accountMap = new Map(accounts.map((account) => [account.guardianEmail.trim().toLowerCase(), account]));
  const results = emails.map((email) => {
    const account = accountMap.get(email);
    const linked = children.filter((child) =>
      child.guardianEmail.trim().toLowerCase() === email ||
      child.guardian2Email?.trim().toLowerCase() === email,
    );
    const guardianName = linked[0]
      ? linked[0].guardianEmail.trim().toLowerCase() === email
        ? linked[0].guardianName
        : (linked[0].guardian2Name ?? email)
      : null;
    const valid = Boolean(EMAIL_PATTERN.test(email) && account && !account.blockedAt && linked.length > 0);
    return {
      email,
      valid,
      guardianName: valid ? guardianName : null,
      children: valid ? linked.map((child) => ({
        childId: child.id,
        childName: `${child.firstName} ${child.lastName}`,
        siteId: child.siteId ?? _siteId,
      })) : [],
    };
  });
  const assignments: VerifiedAssignment[] = [];
  for (const result of results) {
    if (!result.valid) continue;
    const account = accountMap.get(result.email)!;
    for (const child of result.children) {
      assignments.push({
        guardianEmail: result.email,
        guardianId: account.id,
        guardianName: result.guardianName!,
        childId: child.childId,
        childName: child.childName,
      });
    }
  }
  return { results, assignments };
}

function excursionResponse(row: typeof excursionsTable.$inferSelect) {
  return row;
}

function recipientResponse(row: typeof excursionRecipientsTable.$inferSelect) {
  return row;
}

function withoutDuplicateGuardianMilestones(
  logs: (typeof excursionResponseLogsTable.$inferSelect)[],
) {
  const seen = new Set<string>();
  return logs.filter((log) => {
    if (log.event !== "viewed" && log.event !== "acknowledged") return true;
    const key = `${log.recipientId}:${log.event}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

async function getDetail(id: number) {
  const [excursion] = await db.select().from(excursionsTable).where(eq(excursionsTable.id, id));
  if (!excursion) return null;
  const [recipients, logs] = await Promise.all([
    db.select().from(excursionRecipientsTable)
      .where(eq(excursionRecipientsTable.excursionId, id))
      .orderBy(asc(excursionRecipientsTable.guardianEmail), asc(excursionRecipientsTable.childNameSnapshot)),
    db.select().from(excursionResponseLogsTable)
      .where(eq(excursionResponseLogsTable.excursionId, id))
      .orderBy(desc(excursionResponseLogsTable.createdAt)),
  ]);
  return {
    ...excursionResponse(excursion),
    recipients: recipients.map(recipientResponse),
    logs: withoutDuplicateGuardianMilestones(logs),
  };
}

async function addVerifiedAssignments(excursionId: number, assignments: VerifiedAssignment[]) {
  const inserted = [];
  for (const assignment of assignments) {
    const [row] = await db.insert(excursionRecipientsTable).values({
      excursionId,
      guardianEmail: assignment.guardianEmail,
      guardianId: assignment.guardianId,
      guardianNameSnapshot: assignment.guardianName,
      childId: assignment.childId,
      childNameSnapshot: assignment.childName,
    }).onConflictDoNothing({
      target: [
        excursionRecipientsTable.excursionId,
        excursionRecipientsTable.guardianEmail,
        excursionRecipientsTable.childId,
      ],
    }).returning();
    if (row) inserted.push(row);
  }
  return inserted;
}

async function addVerifiedAssignmentsWithExecutor(
  executor: typeof db,
  excursionId: number,
  assignments: VerifiedAssignment[],
) {
  const inserted: Array<typeof excursionRecipientsTable.$inferSelect> = [];
  for (const assignment of assignments) {
    const [row] = await executor.insert(excursionRecipientsTable).values({
      excursionId,
      guardianEmail: assignment.guardianEmail,
      guardianId: assignment.guardianId,
      guardianNameSnapshot: assignment.guardianName,
      childId: assignment.childId,
      childNameSnapshot: assignment.childName,
    }).onConflictDoNothing({
      target: [
        excursionRecipientsTable.excursionId,
        excursionRecipientsTable.guardianEmail,
        excursionRecipientsTable.childId,
      ],
    }).returning();
    if (row) inserted.push(row);
  }
  return inserted;
}

async function createGuardianExcursionNotifications(
  excursion: typeof excursionsTable.$inferSelect,
  recipients: Array<typeof excursionRecipientsTable.$inferSelect>,
) {
  for (const recipient of recipients) {
    await db.insert(guardianNotificationsTable).values({
      guardianEmail: recipient.guardianEmail,
      type: "guardian_excursion",
      title: `Permission required: ${excursion.heading}`,
      body: `Please review the excursion for ${recipient.childNameSnapshot} on ${excursion.excursionDate}.`,
      href: `/excursions/${excursion.id}/recipients/${recipient.id}`,
      referenceId: excursion.id,
      referenceType: "excursion",
      dedupeKey: `excursion:${excursion.id}:recipient:${recipient.id}:sent`,
    }).onConflictDoNothing({ target: guardianNotificationsTable.dedupeKey });
  }
}

async function excursionForGuardian(id: number, recipientId: number, email: string) {
  const [row] = await db.select({
    excursion: excursionsTable,
    recipient: excursionRecipientsTable,
  }).from(excursionRecipientsTable)
    .innerJoin(excursionsTable, eq(excursionsTable.id, excursionRecipientsTable.excursionId))
    .where(and(
      eq(excursionsTable.id, id),
      eq(excursionRecipientsTable.id, recipientId),
      eq(excursionRecipientsTable.guardianEmail, email),
    ))
    .limit(1);
  return row ?? null;
}

async function guardianResponse(id: number, recipientId: number, email: string) {
  const joined = await excursionForGuardian(id, recipientId, email);
  if (!joined || joined.excursion.status !== "sent") return null;
  const logs = await db.select().from(excursionResponseLogsTable)
    .where(and(
      eq(excursionResponseLogsTable.excursionId, id),
      eq(excursionResponseLogsTable.recipientId, recipientId),
      eq(excursionResponseLogsTable.guardianEmail, email),
    )).orderBy(desc(excursionResponseLogsTable.createdAt));
  const signed = logs.find((log) => log.event === "granted" || log.event === "declined");
  const signedMetadata = signed?.metadata && typeof signed.metadata === "object"
    ? signed.metadata
    : null;
  return {
    id: joined.excursion.id,
    siteId: joined.excursion.siteId,
    heading: joined.excursion.heading,
    excursionDate: joined.excursion.excursionDate,
    description: joined.excursion.description,
    venue: joined.excursion.venue,
    riskAssessmentName: joined.excursion.riskAssessmentName,
    purpose: joined.excursion.purpose,
    cost: joined.excursion.cost,
    departureTime: joined.excursion.departureTime,
    arrivalTime: joined.excursion.arrivalTime,
    arrivalAtVenue: joined.excursion.arrivalAtVenue,
    departureFromVenue: joined.excursion.departureFromVenue,
    maximumChildren: joined.excursion.maximumChildren,
    transportMethod: joined.excursion.transportMethod,
    restraintsFitted: joined.excursion.restraintsFitted,
    childToStaffRatio: joined.excursion.childToStaffRatio,
    staffAttending: joined.excursion.staffAttending,
    itemsToBring: joined.excursion.itemsToBring,
    otherInformation: joined.excursion.otherInformation,
    medicalAuthorisationText: joined.excursion.medicalAuthorisationText,
    status: joined.excursion.status,
    createdByStaffId: joined.excursion.createdByStaffId,
    sentAt: joined.excursion.sentAt,
    completedAt: joined.excursion.completedAt,
    createdAt: joined.excursion.createdAt,
    updatedAt: joined.excursion.updatedAt,
    recipientId: joined.recipient.id,
    childId: joined.recipient.childId,
    childName: joined.recipient.childNameSnapshot,
    guardianViewedAt: joined.recipient.viewedAt,
    guardianAcknowledgedAt: joined.recipient.acknowledgedAt,
    decision: joined.recipient.decision,
    signedAt: signed?.createdAt ?? null,
    signedMetadata,
  };
}

// Staff endpoints
router.get("/excursions", async (req, res): Promise<void> => {
  if (!requireStaff(req, res)) return;
  try {
    const rows = await db.select().from(excursionsTable).orderBy(desc(excursionsTable.excursionDate), desc(excursionsTable.createdAt));
    res.json(ListExcursionsResponse.parse(rows.filter((row) => canStaffAccessSite(req, row.siteId)).map(excursionResponse)));
  } catch (err) {
    req.log.error({ err }, "Failed to list excursions");
    res.status(500).json({ error: "Failed to list excursions" });
  }
});

router.post("/excursions/recipients/verify", async (req, res): Promise<void> => {
  if (!requireStaff(req, res)) return;
  const parsed = VerifyExcursionRecipientsBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  if (!canStaffAccessSite(req, parsed.data.siteId)) {
    res.status(403).json({ error: "You do not have access to this site" });
    return;
  }
  try {
    const { results } = await verifyAssignments(parsed.data.siteId, parsed.data.emails);
    res.json(VerifyExcursionRecipientsResponse.parse(results));
  } catch (err) {
    req.log.error({ err }, "Failed to verify excursion recipients");
    res.status(500).json({ error: "Failed to verify excursion recipients" });
  }
});

router.post("/excursions", async (req, res): Promise<void> => {
  if (!requireStaff(req, res)) return;
  const parsed = CreateExcursionBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  if (!hasValidRiskAssessmentPath(parsed.data.riskAssessmentPath)) {
    res.status(400).json({ error: "Invalid risk assessment path" });
    return;
  }
  try {
    if (!canStaffAccessSite(req, parsed.data.siteId)) {
      res.status(403).json({ error: "You do not have access to this site" });
      return;
    }
    const { recipientEmails, ...values } = parsed.data;
    const verified = recipientEmails?.length
      ? await verifyAssignments(parsed.data.siteId, recipientEmails)
      : { results: [], assignments: [] as VerifiedAssignment[] };
    if (verified.results.some((result) => !result.valid)) {
      res.status(400).json({ error: "All recipients must be active guardians linked to an active child" });
      return;
    }
    const excursion = await db.transaction(async (tx) => {
      const riskUpload = values.riskAssessmentPath != null
        ? await validateRiskAssessmentUpload(
            tx as any,
            values.riskAssessmentPath,
            req.session.user!.id,
            values.siteId,
            null,
          )
        : null;
      const [created] = await tx.insert(excursionsTable).values({
        ...values,
        excursionDate: dateOnly(values.excursionDate),
        createdByStaffId: req.session.user!.id,
      } as any).returning();
      if (!created) return null;
      if (riskUpload) await claimRiskAssessmentUpload(tx as any, riskUpload.id, created.id);
      await addVerifiedAssignmentsWithExecutor(tx as any, created.id, verified.assignments);
      return created;
    });
    if (!excursion) { res.status(500).json({ error: "Failed to create excursion" }); return; }
    res.status(201).json(ListExcursionsResponseItem.parse(excursionResponse(excursion)));
  } catch (err) {
    if (err instanceof RiskAssessmentProvenanceError) {
      res.status(err.status).json({ error: err.message });
      return;
    }
    req.log.error({ err }, "Failed to create excursion");
    res.status(500).json({ error: "Failed to create excursion" });
  }
});

router.get("/excursions/:id", async (req, res): Promise<void> => {
  if (!requireStaff(req, res)) return;
  const id = idParam(req.params.id);
  if (!id) { res.status(400).json({ error: "Invalid excursion id" }); return; }
  try {
    const [excursion] = await db.select({ siteId: excursionsTable.siteId }).from(excursionsTable).where(eq(excursionsTable.id, id));
    if (!excursion) { res.status(404).json({ error: "Excursion not found" }); return; }
    if (!canStaffAccessSite(req, excursion.siteId)) { res.status(403).json({ error: "You do not have access to this site" }); return; }
    const detail = await getDetail(id);
    if (!detail) { res.status(404).json({ error: "Excursion not found" }); return; }
    res.json(GetExcursionResponse.parse(detail));
  } catch (err) {
    req.log.error({ err, excursionId: id }, "Failed to get excursion");
    res.status(500).json({ error: "Failed to get excursion" });
  }
});

router.patch("/excursions/:id", async (req, res): Promise<void> => {
  if (!requireStaff(req, res)) return;
  const params = UpdateExcursionParams.safeParse(req.params);
  const parsed = UpdateExcursionBody.safeParse(req.body);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  if (!hasValidRiskAssessmentPath(parsed.data.riskAssessmentPath)) {
    res.status(400).json({ error: "Invalid risk assessment path" });
    return;
  }
  try {
    const [existing] = await db.select().from(excursionsTable).where(eq(excursionsTable.id, params.data.id));
    if (!existing) { res.status(404).json({ error: "Excursion not found" }); return; }
    if (!canStaffAccessSite(req, existing.siteId)) { res.status(403).json({ error: "You do not have access to this site" }); return; }
    const targetSiteId = parsed.data.siteId ?? existing.siteId;
    if (!canStaffAccessSite(req, targetSiteId)) { res.status(403).json({ error: "You do not have access to this site" }); return; }
    if (existing.status !== "draft" && !(existing.status === "sent" && parsed.data.status === "completed")) {
      res.status(409).json({ error: "Only draft excursions can be edited, or a sent excursion can be completed" });
      return;
    }
    if (existing.status === "sent" && Object.keys(parsed.data).some((key) => key !== "status")) {
      res.status(409).json({ error: "Only status can be changed after sending" });
      return;
    }
    if (parsed.data.status === "sent") { res.status(409).json({ error: "Use the send endpoint to send an excursion" }); return; }
    const { recipientEmails, ...values } = parsed.data;
    const verified = recipientEmails?.length
      ? await verifyAssignments(targetSiteId, recipientEmails)
      : { results: [], assignments: [] as VerifiedAssignment[] };
    if (verified.results.some((result) => !result.valid)) {
      res.status(400).json({ error: "All recipients must be active guardians linked to an active child" });
      return;
    }
    const updated = await db.transaction(async (tx) => {
      const riskUpload = values.riskAssessmentPath != null
        ? await validateRiskAssessmentUpload(
            tx as any,
            values.riskAssessmentPath,
            req.session.user!.id,
            targetSiteId,
            params.data.id,
          )
        : null;
      const [row] = await tx.update(excursionsTable).set({
        ...values,
        ...(values.excursionDate ? { excursionDate: dateOnly(values.excursionDate) } : {}),
        ...(values.status === "completed" ? { completedAt: new Date() } : {}),
        updatedAt: new Date(),
      } as any)
        .where(eq(excursionsTable.id, params.data.id)).returning();
      if (riskUpload) await claimRiskAssessmentUpload(tx as any, riskUpload.id, params.data.id);
      if (verified.assignments.length > 0) {
        await addVerifiedAssignmentsWithExecutor(tx as any, params.data.id, verified.assignments);
      }
      return row;
    });
    res.json(UpdateExcursionResponse.parse(excursionResponse(updated)));
  } catch (err) {
    if (err instanceof RiskAssessmentProvenanceError) {
      res.status(err.status).json({ error: err.message });
      return;
    }
    req.log.error({ err, excursionId: params.data.id }, "Failed to update excursion");
    res.status(500).json({ error: "Failed to update excursion" });
  }
});

router.post("/excursions/:id/archive", async (req, res): Promise<void> => {
  if (!requireStaff(req, res)) return;
  const id = idParam(req.params.id);
  if (!id) { res.status(400).json({ error: "Invalid excursion id" }); return; }
  try {
    const [existing] = await db.select().from(excursionsTable).where(eq(excursionsTable.id, id));
    if (!existing) { res.status(404).json({ error: "Excursion not found" }); return; }
    if (!canStaffAccessSite(req, existing.siteId)) {
      res.status(403).json({ error: "You do not have access to this site" });
      return;
    }
    if (existing.status === "archived") {
      res.json(ListExcursionsResponseItem.parse(excursionResponse(existing)));
      return;
    }
    const [archived] = await db.update(excursionsTable)
      .set({ status: "archived", updatedAt: new Date() })
      .where(eq(excursionsTable.id, id))
      .returning();
    res.json(ListExcursionsResponseItem.parse(excursionResponse(archived)));
  } catch (err) {
    req.log.error({ err, excursionId: id }, "Failed to archive excursion");
    res.status(500).json({ error: "Failed to archive excursion" });
  }
});

async function parseRecipientBody(req: Request, res: Response): Promise<{ emails: string[] } | null> {
  const parsed = AddExcursionRecipientsBody.safeParse(req.body ?? {});
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return null; }
  return { emails: parsed.data.recipientEmails };
}

router.post("/excursions/:id/recipients", async (req, res): Promise<void> => {
  if (!requireStaff(req, res)) return;
  const id = idParam(req.params.id);
  if (!id) { res.status(400).json({ error: "Invalid excursion id" }); return; }
  const body = await parseRecipientBody(req, res);
  if (!body) return;
  try {
    const [excursion] = await db.select().from(excursionsTable).where(eq(excursionsTable.id, id));
    if (!excursion) { res.status(404).json({ error: "Excursion not found" }); return; }
    if (!canStaffAccessSite(req, excursion.siteId)) { res.status(403).json({ error: "You do not have access to this site" }); return; }
    if (excursion.status === "completed") { res.status(409).json({ error: "Recipients cannot be added to a completed excursion" }); return; }
    const verified = await verifyAssignments(excursion.siteId, body.emails);
    if (verified.results.some((result) => !result.valid)) {
      res.status(400).json({ error: "All recipients must be active guardians linked to an active child" });
      return;
    }
    const inserted = await addVerifiedAssignments(id, verified.assignments);
    if (excursion.status === "sent" && inserted.length > 0) {
      await db.insert(excursionResponseLogsTable).values(inserted.map((recipient) => ({
        excursionId: id,
        recipientId: recipient.id,
        guardianEmail: recipient.guardianEmail,
        event: "sent",
      })));
      await createGuardianExcursionNotifications(excursion, inserted);
      if (await isEmailChannelEnabled("guardian_excursion")) {
        const branding = await getEmailBranding();
        for (const recipient of inserted) {
          await sendGuardianExcursionEmail([recipient.guardianEmail], {
            excursionHeading: excursion.heading,
            excursionDate: excursion.excursionDate,
            portalUrl: `${getAppUrl()}/excursions/${id}/recipients/${recipient.id}`,
          }, branding);
        }
      }
    }
    res.json(AddExcursionRecipientsResponse.parse(inserted));
  } catch (err) {
    req.log.error({ err, excursionId: id }, "Failed to add excursion recipients");
    res.status(500).json({ error: "Failed to add excursion recipients" });
  }
});

router.delete("/excursions/:id/recipients/:recipientId", async (req, res): Promise<void> => {
  if (!requireStaff(req, res)) return;
  const id = idParam(req.params.id);
  const recipientId = idParam(req.params.recipientId);
  if (!id || !recipientId) { res.status(400).json({ error: "Invalid excursion or recipient id" }); return; }
  try {
    const [excursion] = await db.select().from(excursionsTable).where(eq(excursionsTable.id, id));
    if (!excursion) { res.status(404).json({ error: "Excursion not found" }); return; }
    if (!canStaffAccessSite(req, excursion.siteId)) { res.status(403).json({ error: "You do not have access to this site" }); return; }
    if (excursion.status !== "draft") { res.status(409).json({ error: "Recipients can only be removed before sending" }); return; }
    await db.delete(excursionRecipientsTable).where(and(eq(excursionRecipientsTable.id, recipientId), eq(excursionRecipientsTable.excursionId, id)));
    res.status(204).send();
  } catch (err) {
    req.log.error({ err, excursionId: id, recipientId }, "Failed to remove excursion recipient");
    res.status(500).json({ error: "Failed to remove excursion recipient" });
  }
});

router.post("/excursions/:id/send", async (req, res): Promise<void> => {
  if (!requireStaff(req, res)) return;
  const id = idParam(req.params.id);
  if (!id) { res.status(400).json({ error: "Invalid excursion id" }); return; }
  let body: { emails?: string[] } = {};
  if (req.body != null && Object.keys(req.body).length > 0) {
    const parsed = SendExcursionBody.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
    body = { emails: parsed.data.recipientEmails };
  }
  try {
    const [excursion] = await db.select().from(excursionsTable).where(eq(excursionsTable.id, id));
    if (!excursion) { res.status(404).json({ error: "Excursion not found" }); return; }
    if (!canStaffAccessSite(req, excursion.siteId)) { res.status(403).json({ error: "You do not have access to this site" }); return; }
    if (excursion.status === "completed") { res.status(409).json({ error: "Completed excursions cannot be sent" }); return; }
    let recipientsToNotify: Array<typeof excursionRecipientsTable.$inferSelect> = [];
    if (body.emails?.length) {
      const verified = await verifyAssignments(excursion.siteId, body.emails);
      if (verified.results.some((result) => !result.valid)) {
        res.status(400).json({ error: "All recipients must be active guardians linked to an active child" });
        return;
      }
      recipientsToNotify = await addVerifiedAssignments(id, verified.assignments);
    } else if (excursion.status === "draft") {
      recipientsToNotify = await db.select().from(excursionRecipientsTable).where(eq(excursionRecipientsTable.excursionId, id));
    }
    const allRecipients = await db.select().from(excursionRecipientsTable).where(eq(excursionRecipientsTable.excursionId, id));
    if (allRecipients.length === 0) { res.status(400).json({ error: "At least one verified recipient is required" }); return; }
    const now = new Date();
    const [updated] = await db.update(excursionsTable).set({
      status: "sent",
      sentAt: excursion.sentAt ?? now,
      updatedAt: now,
    }).where(eq(excursionsTable.id, id)).returning();
    await db.insert(excursionResponseLogsTable).values(allRecipients.map((recipient) => ({
      excursionId: id, recipientId: recipient.id, guardianEmail: recipient.guardianEmail, event: "sent",
    })));
    await createGuardianExcursionNotifications(excursion, recipientsToNotify);
    const emails = [...new Set(recipientsToNotify.map((recipient) => recipient.guardianEmail))];
    if (emails.length > 0 && await isEmailChannelEnabled("guardian_excursion")) {
      const branding = await getEmailBranding();
      for (const recipient of recipientsToNotify) {
        await sendGuardianExcursionEmail([recipient.guardianEmail], {
          excursionHeading: excursion.heading,
          excursionDate: excursion.excursionDate,
          portalUrl: `${getAppUrl()}/excursions/${id}/recipients/${recipient.id}`,
        }, branding);
      }
    }
    const detail = await getDetail(id);
    res.json(SendExcursionResponse.parse(detail ?? updated));
  } catch (err) {
    req.log.error({ err, excursionId: id }, "Failed to send excursion");
    res.status(500).json({ error: "Failed to send excursion" });
  }
});

router.post("/excursions/:id/reminder", async (req, res): Promise<void> => {
  if (!requireStaff(req, res)) return;
  const id = idParam(req.params.id);
  if (!id) { res.status(400).json({ error: "Invalid excursion id" }); return; }
  try {
    const [excursion] = await db.select().from(excursionsTable).where(eq(excursionsTable.id, id));
    if (!excursion) { res.status(404).json({ error: "Excursion not found" }); return; }
    if (!canStaffAccessSite(req, excursion.siteId)) { res.status(403).json({ error: "You do not have access to this site" }); return; }
    if (excursion.status !== "sent") { res.status(409).json({ error: "Only sent excursions can have reminders" }); return; }
    const recipients = await db.select().from(excursionRecipientsTable)
      .where(and(eq(excursionRecipientsTable.excursionId, id), isNull(excursionRecipientsTable.decision)));
    if (recipients.length === 0) { res.status(400).json({ error: "No recipients assigned" }); return; }
    await db.insert(excursionResponseLogsTable).values(recipients.map((recipient) => ({
      excursionId: id,
      recipientId: recipient.id,
      guardianEmail: recipient.guardianEmail,
      event: "reminder",
    })));
    if (await isEmailChannelEnabled("guardian_excursion")) {
      const branding = await getEmailBranding();
      for (const recipient of recipients) {
        await sendGuardianExcursionEmail([recipient.guardianEmail], {
          excursionHeading: excursion.heading,
          excursionDate: excursion.excursionDate,
          portalUrl: `${getAppUrl()}/excursions/${id}/recipients/${recipient.id}`,
        }, branding);
      }
    }
    res.json(SendExcursionResponse.parse(await getDetail(id)));
  } catch (err) {
    req.log.error({ err, excursionId: id }, "Failed to send excursion reminder");
    res.status(500).json({ error: "Failed to send excursion reminder" });
  }
});

// Private risk-assessment object. This route is deliberately separate from the
// generic storage object endpoint, which cannot know excursion/site ownership.
router.get("/excursions/:id/risk-assessment", async (req, res): Promise<void> => {
  const id = idParam(req.params.id);
  if (!id) { res.status(400).json({ error: "Invalid excursion id" }); return; }
  const user = req.session.user;
  if (!user || (user.type !== "staff" && user.type !== "guardian")) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  try {
    const [excursion] = await db.select().from(excursionsTable).where(eq(excursionsTable.id, id));
    if (!excursion?.riskAssessmentPath) { res.status(404).json({ error: "Risk assessment not found" }); return; }
    if (user.type === "staff") {
      if (!STAFF_ROLES.has(user.role) || !canStaffAccessSite(req, excursion.siteId)) {
        res.status(403).json({ error: "Forbidden" });
        return;
      }
    } else {
      if (excursion.status !== "sent") { res.status(404).json({ error: "Risk assessment not found" }); return; }
      const [assignment] = await db.select({ id: excursionRecipientsTable.id })
        .from(excursionRecipientsTable)
        .where(and(eq(excursionRecipientsTable.excursionId, id), eq(excursionRecipientsTable.guardianEmail, user.email)));
      if (!assignment) { res.status(403).json({ error: "Forbidden" }); return; }
    }
    const objectFile = await objectStorageService.getObjectEntityFile(excursion.riskAssessmentPath);
    const [header] = await objectFile.download({ start: 0, end: 4 });
    if (header.toString("ascii") !== "%PDF-") {
      req.log.warn({ excursionId: id }, "Rejected non-PDF excursion risk assessment");
      res.status(415).json({ error: "Risk assessment is not a valid PDF" });
      return;
    }
    const response = await objectStorageService.downloadObject(objectFile);
    res.status(response.status);
    response.headers.forEach((value, key) => res.setHeader(key, value));
    const safeName = (excursion.riskAssessmentName || "risk-assessment.pdf").replace(/[^a-zA-Z0-9._ -]/g, "_");
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="${safeName}"`);
    res.setHeader("X-Content-Type-Options", "nosniff");
    if (response.body) Readable.fromWeb(response.body as ReadableStream<Uint8Array>).pipe(res);
    else res.end();
  } catch (err) {
    if (err instanceof ObjectNotFoundError) { res.status(404).json({ error: "Risk assessment not found" }); return; }
    req.log.error({ err, excursionId: id }, "Failed to serve excursion risk assessment");
    res.status(500).json({ error: "Failed to serve risk assessment" });
  }
});

// Guardian endpoints
router.get("/guardian/notifications", async (req, res): Promise<void> => {
  if (!requireGuardian(req, res)) return;
  try {
    const rows = await db.select().from(guardianNotificationsTable)
      .where(eq(guardianNotificationsTable.guardianEmail, req.session.user!.email.toLowerCase()))
      .orderBy(desc(guardianNotificationsTable.createdAt));
    res.json(ListGuardianNotificationsResponse.parse(rows));
  } catch (err) {
    req.log.error({ err }, "Failed to list guardian notifications");
    res.status(500).json({ error: "Failed to list guardian notifications" });
  }
});

router.get("/guardian/excursions", async (req, res): Promise<void> => {
  if (!requireGuardian(req, res)) return;
  try {
    const rows = await db.select({
      excursion: excursionsTable,
      recipient: excursionRecipientsTable,
    }).from(excursionRecipientsTable)
      .innerJoin(excursionsTable, eq(excursionsTable.id, excursionRecipientsTable.excursionId))
      .where(and(
        eq(excursionRecipientsTable.guardianEmail, req.session.user!.email.toLowerCase()),
        eq(excursionsTable.status, "sent"),
      )).orderBy(desc(excursionsTable.excursionDate));
    const result = [];
    for (const row of rows) {
      const detail = await guardianResponse(row.excursion.id, row.recipient.id, req.session.user!.email.toLowerCase());
      if (detail) result.push(detail);
    }
    res.json(ListGuardianExcursionsResponse.parse(result));
  } catch (err) {
    req.log.error({ err }, "Failed to list guardian excursions");
    res.status(500).json({ error: "Failed to list guardian excursions" });
  }
});

router.get("/guardian/excursions/:id/recipients/:recipientId", async (req, res): Promise<void> => {
  if (!requireGuardian(req, res)) return;
  const id = idParam(req.params.id);
  const recipientId = idParam(req.params.recipientId);
  if (!id || !recipientId) { res.status(400).json({ error: "Invalid excursion or recipient id" }); return; }
  try {
    const detail = await guardianResponse(id, recipientId, req.session.user!.email.toLowerCase());
    if (!detail) { res.status(404).json({ error: "Excursion not found" }); return; }
    res.json(GetGuardianExcursionResponse.parse(detail));
  } catch (err) {
    req.log.error({ err, excursionId: id }, "Failed to get guardian excursion");
    res.status(500).json({ error: "Failed to get guardian excursion" });
  }
});

async function markGuardianEvent(req: Request, res: Response, event: "viewed" | "acknowledged"): Promise<void> {
  if (!requireGuardian(req, res)) return;
  const id = idParam(req.params.id);
  const recipientId = idParam(req.params.recipientId);
  if (!id || !recipientId) { res.status(400).json({ error: "Invalid excursion or recipient id" }); return; }
  const email = req.session.user!.email.toLowerCase();
  try {
    const joined = await excursionForGuardian(id, recipientId, email);
    if (!joined || joined.excursion.status !== "sent") { res.status(404).json({ error: "Excursion not found" }); return; }
    const now = new Date();
    const timestampColumn = event === "viewed"
      ? excursionRecipientsTable.viewedAt
      : excursionRecipientsTable.acknowledgedAt;
    const claimed = await db.update(excursionRecipientsTable).set(
      event === "viewed" ? { viewedAt: now } : { acknowledgedAt: now },
    ).where(and(
      eq(excursionRecipientsTable.id, joined.recipient.id),
      isNull(timestampColumn),
    )).returning({ id: excursionRecipientsTable.id });
    if (claimed.length > 0) {
      await db.insert(excursionResponseLogsTable).values({
        excursionId: id, recipientId: joined.recipient.id, guardianEmail: email, event,
      });
    }
    const detail = await guardianResponse(id, recipientId, email);
    res.json((event === "viewed" ? MarkGuardianExcursionViewedResponse : AcknowledgeGuardianExcursionResponse).parse(detail));
  } catch (err) {
    req.log.error({ err, excursionId: id, event }, "Failed to record guardian excursion event");
    res.status(500).json({ error: "Failed to record excursion event" });
  }
}

router.post("/guardian/excursions/:id/recipients/:recipientId/viewed", async (req, res): Promise<void> => markGuardianEvent(req, res, "viewed"));
router.post("/guardian/excursions/:id/recipients/:recipientId/acknowledged", async (req, res): Promise<void> => markGuardianEvent(req, res, "acknowledged"));

router.post("/guardian/excursions/:id/recipients/:recipientId/decision", async (req, res): Promise<void> => {
  if (!requireGuardian(req, res)) return;
  const id = idParam(req.params.id);
  const recipientId = idParam(req.params.recipientId);
  if (!id || !recipientId) { res.status(400).json({ error: "Invalid excursion or recipient id" }); return; }
  const parsed = SubmitGuardianExcursionDecisionBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  if (!parsed.data.medicalAcknowledgement) {
    res.status(400).json({ error: "Medical authorisation must be acknowledged" });
    return;
  }
  if (!parsed.data.typedSignatureName.trim()) {
    res.status(400).json({ error: "A typed signature name is required" });
    return;
  }
  if (!parsed.data.signatureDataUrl?.trim() || !/^data:image\/(?:png|jpeg|jpg|webp);base64,[A-Za-z0-9+/=\s]+$/i.test(parsed.data.signatureDataUrl.trim())) {
    res.status(400).json({ error: "A drawn signature data URL is required" });
    return;
  }
  const email = req.session.user!.email.toLowerCase();
  try {
    const joined = await excursionForGuardian(id, recipientId, email);
    if (!joined || joined.excursion.status !== "sent") { res.status(404).json({ error: "Excursion not found" }); return; }
    if (joined.recipient.decision) { res.status(409).json({ error: "This excursion permission decision has already been submitted" }); return; }
    const now = new Date();
    await db.update(excursionRecipientsTable).set({ decision: parsed.data.decision, acknowledgedAt: joined.recipient.acknowledgedAt ?? now })
      .where(eq(excursionRecipientsTable.id, joined.recipient.id));
    const decisionLog = {
      excursionId: id,
      recipientId: joined.recipient.id,
      guardianEmail: email,
      event: parsed.data.decision,
      metadata: {
        guardianName: parsed.data.typedGuardianName.trim(),
        relationship: parsed.data.relationship.trim(),
        homePhone: parsed.data.homePhone?.trim() || null,
        workPhone: parsed.data.workPhone?.trim() || null,
        mobilePhone: parsed.data.mobilePhone?.trim() || null,
        medicalAcknowledgement: true,
        typedSignatureName: parsed.data.typedSignatureName.trim(),
        signatureDataUrl: parsed.data.signatureDataUrl.trim(),
        signedAt: now.toISOString(),
        decision: parsed.data.decision,
      },
    };
    await db.insert(excursionResponseLogsTable).values(
      joined.recipient.acknowledgedAt
        ? [decisionLog]
        : [
            { excursionId: id, recipientId: joined.recipient.id, guardianEmail: email, event: "acknowledged" },
            decisionLog,
          ],
    );
    res.json(SubmitGuardianExcursionDecisionResponse.parse(await guardianResponse(id, recipientId, email)));
  } catch (err) {
    req.log.error({ err, excursionId: id }, "Failed to submit guardian excursion decision");
    res.status(500).json({ error: "Failed to submit excursion decision" });
  }
});

export default router;