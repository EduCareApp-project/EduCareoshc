import { Router, type IRouter } from "express";
import { eq, and, or, desc, ne, inArray } from "drizzle-orm";
import { db, childMedicationsTable, medicationLogsTable, childrenTable, staffTable, parentAccountsTable } from "@workspace/db";
import { sendMedicationLogEmail } from "../lib/email";
import { getEmailBranding } from "../lib/emailBranding";
import { logger } from "../lib/logger";
import { createNotificationsForRoles } from "../lib/notify";
import { isEmailChannelEnabled } from "../lib/channelMap";
import { getAppUrl } from "../lib/appUrl";

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

  try {
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
      expiryDate: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    res.json(result);
  } catch (err) {
    req.log.error({ err, childId }, "Failed to get medications");
    res.status(500).json({ error: "Failed to get medications" });
  }
});

// ── PUT /children/:id/medications/:slot ──────────────────────────────────────
router.put("/children/:id/medications/:slot", async (req, res): Promise<void> => {
  const childId = parseInt(req.params.id);
  const slot = parseInt(req.params.slot);
  if (isNaN(childId) || isNaN(slot) || slot < 1 || slot > 4) {
    res.status(400).json({ error: "Invalid id or slot (must be 1–4)" }); return;
  }

  try {
    const { name, lastAdministered, toBeAdministeredBy, frequency, administrationTime, dosage, methodOfAdministration, expiryDate: rawExpiryDate } = req.body as Record<string, string>;
    // Normalize expiryDate: empty string or whitespace → null (Postgres date column rejects "")
    const expiryDate = rawExpiryDate?.trim() || null;

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
        expiryDate: expiryDate ?? null,
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
          expiryDate: expiryDate ?? null,
          updatedAt: new Date(),
        },
      })
      .returning();

    res.json({
      ...row,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    });
  } catch (err) {
    req.log.error({ err, childId, slot }, "Failed to update medication");
    res.status(500).json({ error: "Failed to update medication" });
  }
});

// ── GET /children/:id/medications/:medicationId/logs ─────────────────────────
router.get("/children/:id/medications/:medicationId/logs", async (req, res): Promise<void> => {
  const medicationId = parseInt(req.params.medicationId);
  if (isNaN(medicationId)) { res.status(400).json({ error: "Invalid medicationId" }); return; }

  try {
    const rows = await db.select().from(medicationLogsTable)
      .where(eq(medicationLogsTable.medicationId, medicationId))
      .orderBy(desc(medicationLogsTable.administeredAt));

    const enriched = await Promise.all(rows.map(enrichLog));
    res.json(enriched);
  } catch (err) {
    req.log.error({ err, medicationId }, "Failed to get medication logs");
    res.status(500).json({ error: "Failed to get medication logs" });
  }
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

  try {
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
          siteId: childrenTable.siteId,
        }).from(childrenTable).where(eq(childrenTable.id, childId));

        if (!child || !medication) return;

        // ── In-app notification → all staff at the child's site ──────────────
        const childName = `${child.firstName} ${child.lastName}`;
        await createNotificationsForRoles({
          roles: ["admin", "educational_leader", "coordinator", "educator"],
          siteId: child.siteId ?? undefined,
          type: "medication_administered",
          title: "Medication administered",
          body: `${childName} was given ${medication.name} (${dosageAdministered}) by ${enriched.administeredByName ?? "an educator"}.`,
          href: `/children/${childId}`,
          referenceId: log.id,
          referenceType: "medication_log",
          dedupeKeyPrefix: `medication_administered:${log.id}`,
        });

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
        if (!await isEmailChannelEnabled("guardian_medication")) return;

        const portalUrl = `${getAppUrl()}/medication-logs`;

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
  } catch (err) {
    req.log.error({ err, childId, medicationId }, "Failed to create medication log");
    res.status(500).json({ error: "Failed to create medication log" });
  }
});

// ── DELETE /children/:id/medications/:medicationId/logs/:logId ───────────────
router.delete("/children/:id/medications/:medicationId/logs/:logId", async (req, res): Promise<void> => {
  const logId = parseInt(req.params.logId);
  if (isNaN(logId)) { res.status(400).json({ error: "Invalid logId" }); return; }

  try {
    await db.delete(medicationLogsTable).where(eq(medicationLogsTable.id, logId));
    res.sendStatus(204);
  } catch (err) {
    req.log.error({ err, logId }, "Failed to delete medication log");
    res.status(500).json({ error: "Failed to delete medication log" });
  }
});

// ── GET /medications/expiring ─────────────────────────────────────────────────
// Returns children who have at least one named medication slot with an expiry
// date that is today or in the past (expired) or within the next 30 days
// (expiring soon).  Optionally filtered by siteId query param.
router.get("/medications/expiring", async (req, res): Promise<void> => {
  const rawSiteId = req.query.siteId;
  const filterSiteId = rawSiteId ? parseInt(String(rawSiteId)) : null;

  try {
    const now = new Date();
    const todayStr = now.toISOString().split("T")[0];
    const thirtyDaysOut = new Date(now);
    thirtyDaysOut.setDate(now.getDate() + 30);
    const thirtyDaysOutStr = thirtyDaysOut.toISOString().split("T")[0];

    // Fetch all named medication slots that have an expiry date
    const allMeds = await db
      .select({
        id: childMedicationsTable.id,
        childId: childMedicationsTable.childId,
        slot: childMedicationsTable.slot,
        name: childMedicationsTable.name,
        expiryDate: childMedicationsTable.expiryDate,
      })
      .from(childMedicationsTable)
      .where(
        and(
          // Must have a name (slot is in use)
          ne(childMedicationsTable.name, ""),
        )
      );

    // Filter to those expiring within range
    const relevantMeds = allMeds.filter((m) => {
      if (!m.expiryDate || !m.name) return false;
      const d = typeof m.expiryDate === "string" ? m.expiryDate : (m.expiryDate as Date).toISOString().split("T")[0];
      return d <= thirtyDaysOutStr; // expired or expiring soon
    });

    if (relevantMeds.length === 0) { res.json([]); return; }

    // Fetch children for those medication entries
    const childIds = [...new Set(relevantMeds.map((m) => m.childId))];
    const childRows = await db
      .select({
        id: childrenTable.id,
        firstName: childrenTable.firstName,
        lastName: childrenTable.lastName,
        siteId: childrenTable.siteId,
      })
      .from(childrenTable)
      .where(inArray(childrenTable.id, childIds));

    // Apply site filter
    const filteredChildIds = new Set(
      childRows
        .filter((c) => filterSiteId === null || c.siteId === filterSiteId)
        .map((c) => c.id)
    );

    const childMap = new Map(childRows.map((c) => [c.id, c]));

    // Group by child
    type MedEntry = { slot: number; name: string; expiryDate: string; status: "expired" | "expiring_soon" };
    const byChild = new Map<number, MedEntry[]>();

    for (const med of relevantMeds) {
      if (!filteredChildIds.has(med.childId)) continue;
      // expiryDate is guaranteed non-null here (filtered above), but Drizzle types it as string|null
      const rawExpiry = med.expiryDate as string | Date;
      const d = typeof rawExpiry === "string" ? rawExpiry : rawExpiry.toISOString().split("T")[0];
      const status: "expired" | "expiring_soon" = d < todayStr ? "expired" : "expiring_soon";
      const entry: MedEntry = { slot: med.slot, name: med.name, expiryDate: d, status };
      const existing = byChild.get(med.childId) ?? [];
      existing.push(entry);
      byChild.set(med.childId, existing);
    }

    const result = Array.from(byChild.entries()).map(([childId, medications]) => {
      const child = childMap.get(childId)!;
      return {
        childId,
        childFirstName: child.firstName,
        childLastName: child.lastName,
        siteId: child.siteId ?? null,
        medications: medications.sort((a, b) => a.slot - b.slot),
      };
    });

    // Sort: expired first, then by child name
    result.sort((a, b) => {
      const aHasExpired = a.medications.some((m) => m.status === "expired");
      const bHasExpired = b.medications.some((m) => m.status === "expired");
      if (aHasExpired && !bHasExpired) return -1;
      if (!aHasExpired && bHasExpired) return 1;
      return `${a.childFirstName} ${a.childLastName}`.localeCompare(`${b.childFirstName} ${b.childLastName}`);
    });

    res.json(result);
  } catch (err) {
    req.log.error({ err }, "Failed to get expiring medications");
    res.status(500).json({ error: "Failed to get expiring medications" });
  }
});

// ── GET /guardian/medication-logs ────────────────────────────────────────────
router.get("/guardian/medication-logs", async (req, res): Promise<void> => {
  const user = req.session.user!;
  if (user.type !== "guardian") { res.status(403).json({ error: "Guardian only" }); return; }

  const guardianEmail = user.email;

  try {
    const children = await db.select({ id: childrenTable.id, firstName: childrenTable.firstName, lastName: childrenTable.lastName })
      .from(childrenTable)
      .where(or(eq(childrenTable.guardianEmail, guardianEmail), eq(childrenTable.guardian2Email, guardianEmail)));

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
          .orderBy(desc(medicationLogsTable.administeredAt));

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
  } catch (err) {
    req.log.error({ err }, "Failed to get guardian medication logs");
    res.status(500).json({ error: "Failed to get guardian medication logs" });
  }
});

export default router;
