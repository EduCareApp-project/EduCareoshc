import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, childMedicationsTable, medicationLogsTable, childrenTable, staffTable, parentAccountsTable } from "@workspace/db";
import { sendMedicationLogEmail } from "../lib/email";
import { getEmailBranding } from "../lib/emailBranding";
import { logger } from "../lib/logger";

const router: IRouter = Router();

async function enrichLog(log: typeof medicationLogsTable.$inferSelect) {
  const [admin, witness] = await Promise.all([
    db.select({ firstName: staffTable.firstName, lastName: staffTable.lastName })
      .from(staffTable).where(eq(staffTable.id, log.administeredById)).then((r) => r[0]),
    log.witnessId
      ? db.select({ firstName: staffTable.firstName, lastName: staffTable.lastName })
          .from(staffTable).where(eq(staffTable.id, log.witnessId)).then((r) => r[0])
      : Promise.resolve(null),
  ]);
  return {
    ...log,
    administeredAt: log.administeredAt.toISOString(),
    createdAt: log.createdAt.toISOString(),
    administeredByName: admin ? `${admin.firstName} ${admin.lastName}` : null,
    witnessName: witness ? `${witness.firstName} ${witness.lastName}` : null,
  };
}

// ── GET /children/:id/medications ────────────────────────────────────────────
router.get("/children/:id/medications", async (req, res): Promise<void> => {
  const childId = parseInt(req.params.id);
  if (isNaN(childId)) { res.status(400).json({ error: "Invalid id" }); return; }

  const rows = await db.select().from(childMedicationsTable)
    .where(eq(childMedicationsTable.childId, childId));

  const slotMap = new Map(rows.map((r) => [r.slot, r]));
  const result = [1, 2, 3, 4].map((slot) => slotMap.get(slot) ?? {
    id: -(slot),
    childId,
    slot,
    name: "",
    lastAdministered: null,
    toBeAdministeredBy: null,
    dosage: null,
    methodOfAdministration: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  res.json(result);
});

// ── PUT /children/:id/medications/:slot ──────────────────────────────────────
router.put("/children/:id/medications/:slot", async (req, res): Promise<void> => {
  const childId = parseInt(req.params.id);
  const slot = parseInt(req.params.slot);
  if (isNaN(childId) || isNaN(slot) || slot < 1 || slot > 4) {
    res.status(400).json({ error: "Invalid id or slot (must be 1–4)" }); return;
  }

  const { name, lastAdministered, toBeAdministeredBy, frequency, administrationTime, dosage, methodOfAdministration } = req.body as Record<string, string>;

  const [row] = await db
    .insert(childMedicationsTable)
    .values({
      childId,
      slot,
      name: name ?? "",
      lastAdministered: lastAdministered ?? null,
      toBeAdministeredBy: toBeAdministeredBy ?? null,
      frequency: frequency ?? null,
      administrationTime: administrationTime ?? null,
      dosage: dosage ?? null,
      methodOfAdministration: methodOfAdministration ?? null,
    })
    .onConflictDoUpdate({
      target: [childMedicationsTable.childId, childMedicationsTable.slot],
      set: {
        name: name ?? "",
        lastAdministered: lastAdministered ?? null,
        toBeAdministeredBy: toBeAdministeredBy ?? null,
        frequency: frequency ?? null,
        administrationTime: administrationTime ?? null,
        dosage: dosage ?? null,
        methodOfAdministration: methodOfAdministration ?? null,
        updatedAt: new Date(),
      },
    })
    .returning();

  res.json({
    ...row,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  });
});

// ── GET /children/:id/medications/:medicationId/logs ─────────────────────────
router.get("/children/:id/medications/:medicationId/logs", async (req, res): Promise<void> => {
  const medicationId = parseInt(req.params.medicationId);
  if (isNaN(medicationId)) { res.status(400).json({ error: "Invalid medicationId" }); return; }

  const rows = await db.select().from(medicationLogsTable)
    .where(eq(medicationLogsTable.medicationId, medicationId))
    .orderBy(medicationLogsTable.administeredAt);

  const enriched = await Promise.all(rows.map(enrichLog));
  res.json(enriched);
});

// ── POST /children/:id/medications/:medicationId/logs ────────────────────────
router.post("/children/:id/medications/:medicationId/logs", async (req, res): Promise<void> => {
  const childId = parseInt(req.params.id);
  const medicationId = parseInt(req.params.medicationId);
  if (isNaN(childId) || isNaN(medicationId)) {
    res.status(400).json({ error: "Invalid ids" }); return;
  }

  const { administeredAt, dosageAdministered, methodOfAdministration, administeredById, witnessId } =
    req.body as {
      administeredAt: string;
      dosageAdministered: string;
      methodOfAdministration: string;
      administeredById: number;
      witnessId?: number | null;
    };

  if (!administeredAt || !dosageAdministered || !methodOfAdministration || !administeredById) {
    res.status(400).json({ error: "Missing required fields" }); return;
  }

  const [log] = await db.insert(medicationLogsTable).values({
    medicationId,
    childId,
    administeredAt: new Date(administeredAt),
    dosageAdministered,
    methodOfAdministration,
    administeredById,
    witnessId: witnessId ?? null,
  }).returning();

  const enriched = await enrichLog(log);
  res.status(201).json(enriched);

  // ── Notify guardian ────────────────────────────────────────────────────────
  setImmediate(async () => {
    try {
      const [medication] = await db.select().from(childMedicationsTable)
        .where(eq(childMedicationsTable.id, medicationId));
      const [child] = await db.select({
        firstName: childrenTable.firstName,
        lastName: childrenTable.lastName,
        guardianEmail: childrenTable.guardianEmail,
        guardian2Email: childrenTable.guardian2Email,
      }).from(childrenTable).where(eq(childrenTable.id, childId));

      if (!child || !medication) return;

      const recipients = [child.guardianEmail, child.guardian2Email]
        .filter((e): e is string => !!e);

      if (recipients.length === 0) return;

      // Only email if they have a parent account
      const accounts = await db.select({ guardianEmail: parentAccountsTable.guardianEmail })
        .from(parentAccountsTable)
        .where(and(
          eq(parentAccountsTable.guardianEmail, child.guardianEmail),
        ));

      const validRecipients = recipients.filter((email) =>
        accounts.some((a) => a.guardianEmail === email)
      );

      if (validRecipients.length === 0) return;

      const domains = (process.env.REPLIT_DOMAINS ?? "").split(",").map((d) => d.trim()).filter(Boolean);
      const portalUrl = `https://${domains[0] ?? "localhost"}/medication-logs`;

      const branding = await getEmailBranding();
      await sendMedicationLogEmail(validRecipients, {
        childName: `${child.firstName} ${child.lastName}`,
        medicationName: medication.name,
        administeredAt: log.administeredAt.toISOString(),
        dosageAdministered,
        methodOfAdministration,
        administeredByName: enriched.administeredByName ?? "Educator",
        witnessName: enriched.witnessName ?? null,
        portalUrl,
      }, branding);
    } catch (err) {
      logger.warn({ err }, "Failed to send medication log email to guardian");
    }
  });
});

// ── DELETE /children/:id/medications/:medicationId/logs/:logId ───────────────
router.delete("/children/:id/medications/:medicationId/logs/:logId", async (req, res): Promise<void> => {
  const logId = parseInt(req.params.logId);
  if (isNaN(logId)) { res.status(400).json({ error: "Invalid logId" }); return; }

  await db.delete(medicationLogsTable).where(eq(medicationLogsTable.id, logId));
  res.sendStatus(204);
});

// ── GET /guardian/medication-logs ────────────────────────────────────────────
router.get("/guardian/medication-logs", async (req, res): Promise<void> => {
  const user = req.session.user!;
  if (user.type !== "guardian") { res.status(403).json({ error: "Guardian only" }); return; }

  const guardianEmail = user.email;

  const children = await db.select({ id: childrenTable.id, firstName: childrenTable.firstName, lastName: childrenTable.lastName })
    .from(childrenTable)
    .where(eq(childrenTable.guardianEmail, guardianEmail));

  if (children.length === 0) { res.json([]); return; }

  const childIds = children.map((c) => c.id);
  const childMap = new Map(children.map((c) => [c.id, `${c.firstName} ${c.lastName}`]));

  const allLogs: unknown[] = [];
  for (const childId of childIds) {
    const meds = await db.select().from(childMedicationsTable)
      .where(eq(childMedicationsTable.childId, childId));

    for (const med of meds) {
      const logs = await db.select().from(medicationLogsTable)
        .where(eq(medicationLogsTable.medicationId, med.id))
        .orderBy(medicationLogsTable.administeredAt);

      for (const log of logs) {
        const enriched = await enrichLog(log);
        allLogs.push({
          ...enriched,
          childName: childMap.get(log.childId) ?? "Unknown",
          medicationName: med.name,
        });
      }
    }
  }

  allLogs.sort((a: any, b: any) => new Date(b.administeredAt).getTime() - new Date(a.administeredAt).getTime());
  res.json(allLogs);
});

export default router;
