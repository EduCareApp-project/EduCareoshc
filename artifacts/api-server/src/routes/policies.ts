import { Router, type IRouter, type Request } from "express";
import { createNotification } from "../lib/notify";
import { logger } from "../lib/logger";
import { and, desc, eq, inArray } from "drizzle-orm";
import {
  db,
  policiesTable,
  policyAcknowledgmentsTable,
  policyDistributionsTable,
  staffTable,
} from "@workspace/db";
import {
  AddPolicyDistributionBody,
  AddPolicyDistributionParams,
  AddPolicyDistributionResponse,
  AcknowledgePolicyParams,
  AcknowledgePolicyBody,
  CreatePolicyBody,
  DeletePolicyParams,
  GetPolicyAcknowledgmentsParams,
  GetPolicyAcknowledgmentsResponse,
  GetPolicyAcknowledgmentsResponseItem,
  ListPoliciesResponse,
  ListPoliciesResponseItem,
  UpdatePolicyBody,
  UpdatePolicyParams,
} from "@workspace/api-zod";

const router: IRouter = Router();
const MANAGEMENT_ROLES = new Set(["admin", "admin_support", "educational_leader"]);

function isPolicyManager(req: Request): boolean {
  const user = req.session?.user;
  return user?.type === "staff" && MANAGEMENT_ROLES.has(user.role);
}

function getRoleList(notifyRoles: string | null | undefined): string[] {
  return [...new Set((notifyRoles ?? "").split(",").map((role) => role.trim()).filter(Boolean))];
}

function normalizedRoles(roles: string | null | undefined): string {
  return getRoleList(roles).sort().join(",");
}

async function enrichPolicies(rows: (typeof policiesTable.$inferSelect)[]) {
  if (rows.length === 0) return [];
  const policyIds = rows.map((policy) => policy.id);
  const [distributionRows, acknowledgmentRows] = await Promise.all([
    db.select({
      policyId: policyDistributionsTable.policyId,
      staffId: policyDistributionsTable.staffId,
    }).from(policyDistributionsTable).where(inArray(policyDistributionsTable.policyId, policyIds)),
    db.select({
      policyId: policyAcknowledgmentsTable.policyId,
      staffId: policyAcknowledgmentsTable.staffId,
    }).from(policyAcknowledgmentsTable).where(inArray(policyAcknowledgmentsTable.policyId, policyIds)),
  ]);
  const distributedByPolicy = new Map<number, Set<number>>();
  const acknowledgedByPolicy = new Map<number, Set<number>>();
  for (const { policyId, staffId } of distributionRows) {
    const ids = distributedByPolicy.get(policyId) ?? new Set<number>();
    ids.add(staffId);
    distributedByPolicy.set(policyId, ids);
  }
  for (const { policyId, staffId } of acknowledgmentRows) {
    const ids = acknowledgedByPolicy.get(policyId) ?? new Set<number>();
    ids.add(staffId);
    acknowledgedByPolicy.set(policyId, ids);
  }
  return rows.map((policy) => ({
    ...policy,
    distributedStaffIds: [...(distributedByPolicy.get(policy.id) ?? [])],
    acknowledgedStaffIds: [...(acknowledgedByPolicy.get(policy.id) ?? [])],
  }));
}

router.get("/policies", async (req, res): Promise<void> => {
  try {
    const rows = await db.select().from(policiesTable).orderBy(policiesTable.policyNumber, policiesTable.title);
    res.json(ListPoliciesResponse.parse(await enrichPolicies(rows)));
  } catch (err) {
    req.log.error({ err }, "Failed to fetch policies");
    res.status(500).json({ error: "Failed to fetch policies" });
  }
});

router.post("/policies", async (req, res): Promise<void> => {
  if (!isPolicyManager(req)) { res.status(403).json({ error: "Forbidden" }); return; }
  const parsed = CreatePolicyBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  try {
    const policy = await db.transaction(async (tx) => {
      const [created] = await tx.insert(policiesTable).values({
        ...parsed.data,
        distributionInitialized: true,
      } as any).returning();
      const roles = getRoleList(created.notifyRoles);
      let recipients: { id: number }[] = [];
      if (roles.length > 0) {
        recipients = await tx.select({ id: staffTable.id })
          .from(staffTable)
          .where(and(eq(staffTable.status, "active"), inArray(staffTable.role, roles)));
        if (recipients.length > 0) {
          await tx.insert(policyDistributionsTable).values(
            recipients.map(({ id }) => ({ policyId: created.id, staffId: id })),
          ).onConflictDoNothing();
        }
      }
      return { created, recipients };
    });

    if (policy.created.isActive) {
      for (const recipient of policy.recipients) {
        void createNotification({
          staffId: recipient.id,
          type: "policy_new",
          title: `New policy added: ${policy.created.title}`,
          href: "/policies",
          referenceId: policy.created.id,
          referenceType: "policy",
          dedupeKey: `policy_new:${policy.created.id}:${recipient.id}`,
        }).catch((err) => logger.warn({ err }, "Failed to send policy_new notification"));
      }
    }
    const [enriched] = await enrichPolicies([policy.created]);
    res.status(201).json(ListPoliciesResponseItem.parse(enriched));
  } catch (err) {
    req.log.error({ err }, "Failed to create policy");
    res.status(500).json({ error: "Failed to create policy" });
  }
});

router.patch("/policies/:id", async (req, res): Promise<void> => {
  if (!isPolicyManager(req)) { res.status(403).json({ error: "Forbidden" }); return; }
  const params = UpdatePolicyParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const parsed = UpdatePolicyBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const { bumpVersion, ...fields } = parsed.data;
  try {
    const updated = await db.transaction(async (tx) => {
      const [current] = await tx.select().from(policiesTable)
        .where(eq(policiesTable.id, params.data.id)).for("update");
      if (!current) return null;

      const updateData: Record<string, unknown> = { ...fields, updatedAt: new Date() };
      if (bumpVersion) updateData.versionNumber = (current.versionNumber ?? 1) + 1;
      const [policy] = await tx.update(policiesTable)
        .set(updateData as any)
        .where(eq(policiesTable.id, params.data.id))
        .returning();

      // A role edit may expand a snapshot, but ordinary edits never reseed it.
      const changedRoles = Object.hasOwn(fields, "notifyRoles")
        && normalizedRoles(fields.notifyRoles) !== normalizedRoles(current.notifyRoles);
      if (changedRoles && policy.isActive) {
        const roles = getRoleList(policy.notifyRoles);
        if (roles.length > 0) {
          const activeStaff = await tx.select({ id: staffTable.id })
            .from(staffTable)
            .where(and(eq(staffTable.status, "active"), inArray(staffTable.role, roles)));
          if (activeStaff.length > 0) {
            await tx.insert(policyDistributionsTable).values(
              activeStaff.map(({ id }) => ({ policyId: policy.id, staffId: id })),
            ).onConflictDoNothing();
          }
        }
      }
      return { current, policy };
    });

    if (!updated) { res.status(404).json({ error: "Not found" }); return; }
    if (bumpVersion && updated.policy.isActive) {
      const [distribution, acknowledgments] = await Promise.all([
        db.select({ staffId: policyDistributionsTable.staffId })
          .from(policyDistributionsTable)
          .where(eq(policyDistributionsTable.policyId, updated.policy.id)),
        db.select({ staffId: policyAcknowledgmentsTable.staffId })
          .from(policyAcknowledgmentsTable)
          .where(and(
            eq(policyAcknowledgmentsTable.policyId, updated.policy.id),
            eq(policyAcknowledgmentsTable.policyVersion, updated.policy.versionNumber),
          )),
      ]);
      const acknowledgedIds = new Set(acknowledgments.map(({ staffId }) => staffId));
      const distributedIds = [...new Set(distribution.map(({ staffId }) => staffId))]
        .filter((staffId) => !acknowledgedIds.has(staffId));
      const activeRecipients = distributedIds.length
        ? await db.select({ id: staffTable.id }).from(staffTable)
          .where(and(eq(staffTable.status, "active"), inArray(staffTable.id, distributedIds)))
        : [];
      for (const recipient of activeRecipients) {
        void createNotification({
          staffId: recipient.id,
          type: "policy_updated",
          title: `Policy updated: ${updated.policy.title} (v${updated.policy.versionNumber})`,
          body: "Please review and acknowledge the updated policy.",
          href: "/policies",
          referenceId: updated.policy.id,
          referenceType: "policy",
          dedupeKey: `policy_updated:${updated.policy.id}:v${updated.policy.versionNumber}:${recipient.id}`,
        }).catch((err) => logger.warn({ err }, "Failed to send policy_updated notification"));
      }
    }
    const [enriched] = await enrichPolicies([updated.policy]);
    res.json(ListPoliciesResponseItem.parse(enriched));
  } catch (err) {
    req.log.error({ err, policyId: params.data.id }, "Failed to update policy");
    res.status(500).json({ error: "Failed to update policy" });
  }
});

router.post("/policies/:id/distribution", async (req, res): Promise<void> => {
  if (!isPolicyManager(req)) { res.status(403).json({ error: "Forbidden" }); return; }
  const params = AddPolicyDistributionParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const parsed = AddPolicyDistributionBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  try {
    const result = await db.transaction(async (tx) => {
      const [policy] = await tx.select().from(policiesTable)
        .where(eq(policiesTable.id, params.data.id)).for("update");
      if (!policy) return { error: "not-found" as const };
      if (!policy.isActive) return { error: "inactive" as const };
      const [staff] = await tx.select({ id: staffTable.id, status: staffTable.status })
        .from(staffTable).where(eq(staffTable.id, parsed.data.staffId));
      if (!staff || staff.status !== "active") return { error: "staff-not-found" as const };
      const [inserted] = await tx.insert(policyDistributionsTable)
        .values({ policyId: policy.id, staffId: staff.id })
        .onConflictDoNothing()
        .returning({ id: policyDistributionsTable.id });
      return { policy, inserted: Boolean(inserted) };
    });

    if ("error" in result) {
      const status = result.error === "not-found" || result.error === "staff-not-found" ? 404 : 409;
      res.status(status).json({ error: result.error === "inactive" ? "Inactive policies cannot be distributed" : "Policy or active staff member not found" });
      return;
    }
    if (result.inserted) {
      void createNotification({
        staffId: parsed.data.staffId,
        type: "policy_new",
        title: `New policy added: ${result.policy.title}`,
        href: "/policies",
        referenceId: result.policy.id,
        referenceType: "policy",
        dedupeKey: `policy_new:${result.policy.id}:${parsed.data.staffId}`,
      }).catch((err) => logger.warn({ err }, "Failed to send policy_new notification"));
    }
    const [enriched] = await enrichPolicies([result.policy]);
    res.status(200).json(AddPolicyDistributionResponse.parse(enriched));
  } catch (err) {
    req.log.error({ err, policyId: params.data.id }, "Failed to add policy distribution");
    res.status(500).json({ error: "Failed to add policy distribution" });
  }
});

router.delete("/policies/:id", async (req, res): Promise<void> => {
  if (!isPolicyManager(req)) { res.status(403).json({ error: "Forbidden" }); return; }
  const params = DeletePolicyParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  try {
    await db.transaction(async (tx) => {
      await tx.delete(policyDistributionsTable).where(eq(policyDistributionsTable.policyId, params.data.id));
      await tx.delete(policyAcknowledgmentsTable).where(eq(policyAcknowledgmentsTable.policyId, params.data.id));
      await tx.delete(policiesTable).where(eq(policiesTable.id, params.data.id));
    });
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

  const user = req.session?.user;
  const manager = isPolicyManager(req);
  if (!manager && (user?.type !== "staff" || user.id !== parsed.data.staffId)) {
    res.status(403).json({ error: "Staff may only acknowledge policies for themselves" });
    return;
  }
  try {
    const result = await db.transaction(async (tx) => {
      const [policy] = await tx.select().from(policiesTable)
        .where(eq(policiesTable.id, params.data.id)).for("update");
      if (!policy) return { error: "not-found" as const };
      if (!policy.isActive) return { error: "inactive" as const };
      const [staff] = await tx.select().from(staffTable)
        .where(eq(staffTable.id, parsed.data.staffId));
      if (!staff || staff.status !== "active") return { error: "staff-not-found" as const };
      const [distribution] = await tx.select({ id: policyDistributionsTable.id })
        .from(policyDistributionsTable)
        .where(and(
          eq(policyDistributionsTable.policyId, policy.id),
          eq(policyDistributionsTable.staffId, staff.id),
        ));
      if (!distribution) return { error: "not-distributed" as const };
      const [existing] = await tx.select().from(policyAcknowledgmentsTable)
        .where(and(
          eq(policyAcknowledgmentsTable.policyId, policy.id),
          eq(policyAcknowledgmentsTable.staffId, staff.id),
          eq(policyAcknowledgmentsTable.policyVersion, policy.versionNumber),
        ))
        .orderBy(desc(policyAcknowledgmentsTable.acknowledgedAt))
        .limit(1);
      if (existing) return { acknowledgment: existing, staff, duplicate: true };
      const [acknowledgment] = await tx.insert(policyAcknowledgmentsTable).values({
        policyId: policy.id,
        staffId: staff.id,
        policyVersion: policy.versionNumber,
      }).returning();
      return { acknowledgment, staff, duplicate: false };
    });

    if ("error" in result) {
      const status = result.error === "not-found" || result.error === "staff-not-found" ? 404 : 409;
      const message = result.error === "inactive"
        ? "Inactive policies cannot be acknowledged"
        : result.error === "not-distributed"
          ? "Staff member is not in this policy's distribution"
          : "Policy or active staff member not found";
      res.status(status).json({ error: message });
      return;
    }
    const response = GetPolicyAcknowledgmentsResponseItem.parse({
      ...result.acknowledgment,
      staffName: `${result.staff.firstName} ${result.staff.lastName}`,
      staffRole: result.staff.role,
    });
    res.status(result.duplicate ? 200 : 201).json(response);
  } catch (err) {
    req.log.error({ err, policyId: params.data.id }, "Failed to acknowledge policy");
    res.status(500).json({ error: "Failed to acknowledge policy" });
  }
});

router.get("/policies/:id/acknowledgments", async (req, res): Promise<void> => {
  const params = GetPolicyAcknowledgmentsParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  try {
    const rows = await db.select().from(policyAcknowledgmentsTable)
      .where(eq(policyAcknowledgmentsTable.policyId, params.data.id))
      .orderBy(desc(policyAcknowledgmentsTable.acknowledgedAt));
    const staffList = await db.select().from(staffTable);
    const staffById = new Map(staffList.map((staff) => [staff.id, staff]));
    const enriched = rows.map((acknowledgment) => {
      const staff = staffById.get(acknowledgment.staffId);
      return {
        ...acknowledgment,
        staffName: staff ? `${staff.firstName} ${staff.lastName}` : null,
        staffRole: staff?.role ?? null,
      };
    });
    res.json(GetPolicyAcknowledgmentsResponse.parse(enriched));
  } catch (err) {
    req.log.error({ err, policyId: params.data.id }, "Failed to fetch policy acknowledgments");
    res.status(500).json({ error: "Failed to fetch policy acknowledgments" });
  }
});

export default router;