import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, policiesTable, policyAcknowledgmentsTable, staffTable } from "@workspace/db";
import {
  CreatePolicyBody, AcknowledgePolicyParams, AcknowledgePolicyBody, GetPolicyAcknowledgmentsParams,
  ListPoliciesResponse, ListPoliciesResponseItem, GetPolicyAcknowledgmentsResponseItem,
  GetPolicyAcknowledgmentsResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/policies", async (_req, res): Promise<void> => {
  const rows = await db.select().from(policiesTable).orderBy(policiesTable.category);
  res.json(ListPoliciesResponse.parse(rows));
});

router.post("/policies", async (req, res): Promise<void> => {
  const parsed = CreatePolicyBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [policy] = await db.insert(policiesTable).values(parsed.data as any).returning();
  res.status(201).json(ListPoliciesResponseItem.parse(policy));
});

router.post("/policies/:id/acknowledge", async (req, res): Promise<void> => {
  const params = AcknowledgePolicyParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const parsed = AcknowledgePolicyBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [ack] = await db.insert(policyAcknowledgmentsTable).values({ policyId: params.data.id, staffId: parsed.data.staffId }).returning();
  const [staff] = await db.select().from(staffTable).where(eq(staffTable.id, ack.staffId));
  res.status(201).json(GetPolicyAcknowledgmentsResponseItem.parse({
    ...ack,
    staffName: staff ? `${staff.firstName} ${staff.lastName}` : null,
  }));
});

router.get("/policies/:id/acknowledgments", async (req, res): Promise<void> => {
  const params = GetPolicyAcknowledgmentsParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const rows = await db.select().from(policyAcknowledgmentsTable).where(eq(policyAcknowledgmentsTable.policyId, params.data.id));
  const staffList = await db.select().from(staffTable);
  const enriched = rows.map((a) => {
    const staff = staffList.find((s) => s.id === a.staffId);
    return { ...a, staffName: staff ? `${staff.firstName} ${staff.lastName}` : null };
  });
  res.json(GetPolicyAcknowledgmentsResponse.parse(enriched));
});

export default router;
