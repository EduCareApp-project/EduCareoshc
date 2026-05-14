import { Router, type IRouter } from "express";
import { eq, desc } from "drizzle-orm";
import { db, policiesTable, policyAcknowledgmentsTable, staffTable } from "@workspace/db";
import {
  CreatePolicyBody, UpdatePolicyBody, UpdatePolicyParams, DeletePolicyParams,
  AcknowledgePolicyParams, AcknowledgePolicyBody, GetPolicyAcknowledgmentsParams,
  ListPoliciesResponse, ListPoliciesResponseItem, GetPolicyAcknowledgmentsResponseItem,
  GetPolicyAcknowledgmentsResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/policies", async (_req, res): Promise<void> => {
  const rows = await db.select().from(policiesTable).orderBy(policiesTable.policyNumber, policiesTable.title);
  res.json(ListPoliciesResponse.parse(rows));
});

router.post("/policies", async (req, res): Promise<void> => {
  const parsed = CreatePolicyBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [policy] = await db.insert(policiesTable).values(parsed.data as any).returning();
  res.status(201).json(ListPoliciesResponseItem.parse(policy));
});

router.patch("/policies/:id", async (req, res): Promise<void> => {
  const params = UpdatePolicyParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const parsed = UpdatePolicyBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const { bumpVersion, ...fields } = parsed.data;

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

  res.json(ListPoliciesResponseItem.parse(updated));
});

router.delete("/policies/:id", async (req, res): Promise<void> => {
  const params = DeletePolicyParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  await db.delete(policyAcknowledgmentsTable).where(eq(policyAcknowledgmentsTable.policyId, params.data.id));
  await db.delete(policiesTable).where(eq(policiesTable.id, params.data.id));
  res.status(204).end();
});

router.post("/policies/:id/acknowledge", async (req, res): Promise<void> => {
  const params = AcknowledgePolicyParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const parsed = AcknowledgePolicyBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

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
});

router.get("/policies/:id/acknowledgments", async (req, res): Promise<void> => {
  const params = GetPolicyAcknowledgmentsParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
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
});

export default router;
