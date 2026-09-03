import { Router, type IRouter } from "express";
import { createNotification } from "../lib/notify";
import { logger } from "../lib/logger";
import { eq, desc } from "drizzle-orm";
import { db, policiesTable, policyAcknowledgmentsTable, staffTable } from "@workspace/db";
import {
  CreatePolicyBody, UpdatePolicyBody, UpdatePolicyParams, DeletePolicyParams,
  AcknowledgePolicyParams, AcknowledgePolicyBody, GetPolicyAcknowledgmentsParams,
  ListPoliciesResponse, ListPoliciesResponseItem, GetPolicyAcknowledgmentsResponseItem,
  GetPolicyAcknowledgmentsResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/policies", async (req, res): Promise<void> => {
  try {
    const rows = await db.select().from(policiesTable).orderBy(policiesTable.policyNumber, policiesTable.title);
    res.json(ListPoliciesResponse.parse(rows));
  } catch (err) {
    req.log.error({ err }, "Failed to fetch policies");
    res.status(500).json({ error: "Failed to fetch policies" });
  }
});

router.post("/policies", async (req, res): Promise<void> => {
  const parsed = CreatePolicyBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  try {
    const [policy] = await db.insert(policiesTable).values(parsed.data as any).returning();

    const targetRoles = policy.notifyRoles
      ? policy.notifyRoles.split(",").map((r) => r.trim()).filter(Boolean)
      : ["admin", "admin_support", "educational_leader", "coordinator", "educator"];
    const allStaff = await db.select({ id: staffTable.id, role: staffTable.role })
      .from(staffTable).where(eq(staffTable.status, "active"));
    for (const s of allStaff.filter((s) => targetRoles.includes(s.role))) {
      createNotification({
        staffId: s.id,
        type: "policy_new",
        title: `New policy added: ${policy.title}`,
        href: `/policies`,
        referenceId: policy.id,
        referenceType: "policy",
      }).catch((err) => logger.warn({ err }, "Failed to send policy_new notification"));
    }

    res.status(201).json(ListPoliciesResponseItem.parse(policy));
  } catch (err) {
    req.log.error({ err }, "Failed to create policy");
    res.status(500).json({ error: "Failed to create policy" });
  }
});

router.patch("/policies/:id", async (req, res): Promise<void> => {
  const params = UpdatePolicyParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const parsed = UpdatePolicyBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const { bumpVersion, ...fields } = parsed.data;

  try {
    // Fetch current policy to get current versionNumber
    const [current] = await db.select().from(policiesTable).where(eq(policiesTable.id, params.data.id));
    if (!current) { res.status(404).json({ error: "Not found" }); return; }

    const updateData: Record<string, unknown> = {
      ...fields,
      updatedAt: new Date(),
    };

    if (bumpVersion) {
      updateData.versionNumber = (current.versionNumber ?? 1) + 1;
    }

    const [updated] = await db
      .update(policiesTable)
      .set(updateData as any)
      .where(eq(policiesTable.id, params.data.id))
      .returning();

    if (bumpVersion) {
      const newVersion = updated.versionNumber;
      const alreadyAcked = await db.select({ staffId: policyAcknowledgmentsTable.staffId })
        .from(policyAcknowledgmentsTable)
        .where(eq(policyAcknowledgmentsTable.policyId, updated.id));
      const ackedIds = new Set(alreadyAcked.map((a) => a.staffId));
      const allStaff = await db.select({ id: staffTable.id })
        .from(staffTable).where(eq(staffTable.status, "active"));
      for (const s of allStaff.filter((s) => !ackedIds.has(s.id))) {
        createNotification({
          staffId: s.id,
          type: "policy_updated",
          title: `Policy updated: ${updated.title} (v${newVersion})`,
          body: "Please review and acknowledge the updated policy.",
          href: `/policies`,
          referenceId: updated.id,
          referenceType: "policy",
          dedupeKey: `policy_updated:${updated.id}:v${newVersion}:${s.id}`,
        }).catch((err) => logger.warn({ err }, "Failed to send policy_updated notification"));
      }
    }

    res.json(ListPoliciesResponseItem.parse(updated));
  } catch (err) {
    req.log.error({ err, policyId: params.data.id }, "Failed to update policy");
    res.status(500).json({ error: "Failed to update policy" });
  }
});

router.delete("/policies/:id", async (req, res): Promise<void> => {
  const params = DeletePolicyParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  try {
    await db.delete(policyAcknowledgmentsTable).where(eq(policyAcknowledgmentsTable.policyId, params.data.id));
    await db.delete(policiesTable).where(eq(policiesTable.id, params.data.id));
    res.status(204).end();
  } catch (err) {
    req.log.error({ err, policyId: params.data.id }, "Failed to delete policy");
    res.status(500).json({ error: "Failed to delete policy" });
  }
});

router.post("/policies/:id/acknowledge", async (req, res): Promise<void> => {
  const params = AcknowledgePolicyParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const parsed = AcknowledgePolicyBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  try {
    // Get current version of the policy
    const [policy] = await db.select().from(policiesTable).where(eq(policiesTable.id, params.data.id));
    if (!policy) { res.status(404).json({ error: "Not found" }); return; }

    const [ack] = await db.insert(policyAcknowledgmentsTable).values({
      policyId: params.data.id,
      staffId: parsed.data.staffId,
      policyVersion: policy.versionNumber,
    }).returning();

    const [staff] = await db.select().from(staffTable).where(eq(staffTable.id, ack.staffId));
    res.status(201).json(GetPolicyAcknowledgmentsResponseItem.parse({
      ...ack,
      staffName: staff ? `${staff.firstName} ${staff.lastName}` : null,
      staffRole: staff?.role ?? null,
    }));
  } catch (err) {
    req.log.error({ err, policyId: params.data.id }, "Failed to acknowledge policy");
    res.status(500).json({ error: "Failed to acknowledge policy" });
  }
});

router.get("/policies/:id/acknowledgments", async (req, res): Promise<void> => {
  const params = GetPolicyAcknowledgmentsParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  try {
    const rows = await db
      .select()
      .from(policyAcknowledgmentsTable)
      .where(eq(policyAcknowledgmentsTable.policyId, params.data.id))
      .orderBy(desc(policyAcknowledgmentsTable.acknowledgedAt));
    const staffList = await db.select().from(staffTable);
    const enriched = rows.map((a) => {
      const staff = staffList.find((s) => s.id === a.staffId);
      return { ...a, staffName: staff ? `${staff.firstName} ${staff.lastName}` : null, staffRole: staff?.role ?? null };
    });
    res.json(GetPolicyAcknowledgmentsResponse.parse(enriched));
  } catch (err) {
    req.log.error({ err, policyId: params.data.id }, "Failed to fetch policy acknowledgments");
    res.status(500).json({ error: "Failed to fetch policy acknowledgments" });
  }
});

export default router;
