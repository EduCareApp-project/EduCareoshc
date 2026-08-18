import { Router, type IRouter } from "express";
import { eq, and, inArray, desc } from "drizzle-orm";
import {
  db,
  guardianFinancialAccountsTable,
  guardianCommunicationLogsTable,
  guardianPaymentPlansTable,
  childrenTable,
  sitesTable,
} from "@workspace/db";

const router: IRouter = Router();

const VALID_STATUSES = ["active", "payment_plan", "suspended"] as const;
type FinancialStatus = (typeof VALID_STATUSES)[number];

/** Get or lazily create the financial account row for a guardian. */
async function getOrCreateAccount(guardianEmail: string) {
  const [existing] = await db
    .select()
    .from(guardianFinancialAccountsTable)
    .where(eq(guardianFinancialAccountsTable.guardianEmail, guardianEmail));
  if (existing) return existing;

  const [created] = await db
    .insert(guardianFinancialAccountsTable)
    .values({ guardianEmail, status: "active" })
    .onConflictDoNothing()
    .returning();

  // Race condition safety: re-read if conflict swallowed the insert
  if (!created) {
    const [retry] = await db
      .select()
      .from(guardianFinancialAccountsTable)
      .where(eq(guardianFinancialAccountsTable.guardianEmail, guardianEmail));
    return retry;
  }
  return created;
}

// ── Suspended guardian report ─────────────────────────────────────────────────
// NOTE: This MUST come before /:email routes to prevent "financial" matching as email.
router.get("/guardians/financial/suspended-report", async (req, res): Promise<void> => {
  const siteIdParam = req.query.siteId ? parseInt(req.query.siteId as string, 10) : null;

  try {
    const suspendedAccounts = await db
      .select()
      .from(guardianFinancialAccountsTable)
      .where(eq(guardianFinancialAccountsTable.status, "suspended"));

    if (suspendedAccounts.length === 0) {
      res.json([]);
      return;
    }

    const suspendedEmails = suspendedAccounts.map((a) => a.guardianEmail);

    const [childrenByPrimary, childrenBySecondary, allSites] = await Promise.all([
      db.select().from(childrenTable).where(inArray(childrenTable.guardianEmail, suspendedEmails)),
      db.select().from(childrenTable).where(inArray(childrenTable.guardian2Email, suspendedEmails)),
      db.select().from(sitesTable).where(eq(sitesTable.status, "active")),
    ]);

    // Merge child lists, de-duplicating by id
    const childMap = new Map<number, (typeof childrenByPrimary)[number]>();
    for (const c of [...childrenByPrimary, ...childrenBySecondary]) childMap.set(c.id, c);
    const allChildren = Array.from(childMap.values());

    type GuardianEntry = {
      guardianEmail: string;
      guardianName: string;
      guardianPhone: string;
      childNames: string[];
    };

    const siteMap = new Map<
      number,
      { siteName: string; guardians: Map<string, GuardianEntry> }
    >();

    for (const child of allChildren) {
      if (!child.siteId) continue;
      const site = allSites.find((s) => s.id === child.siteId);
      if (!site) continue;
      if (siteIdParam !== null && site.id !== siteIdParam) continue;

      if (!siteMap.has(site.id)) siteMap.set(site.id, { siteName: site.name, guardians: new Map() });
      const siteEntry = siteMap.get(site.id)!;

      const childName = `${child.firstName} ${child.lastName}`;

      // Primary guardian
      if (child.guardianEmail && suspendedEmails.includes(child.guardianEmail)) {
        if (!siteEntry.guardians.has(child.guardianEmail)) {
          siteEntry.guardians.set(child.guardianEmail, {
            guardianEmail: child.guardianEmail,
            guardianName: child.guardianName,
            guardianPhone: child.guardianPhone,
            childNames: [],
          });
        }
        const entry = siteEntry.guardians.get(child.guardianEmail)!;
        if (!entry.childNames.includes(childName)) entry.childNames.push(childName);
      }

      // Secondary guardian
      if (child.guardian2Email && suspendedEmails.includes(child.guardian2Email)) {
        if (!siteEntry.guardians.has(child.guardian2Email)) {
          siteEntry.guardians.set(child.guardian2Email, {
            guardianEmail: child.guardian2Email,
            guardianName: child.guardian2Name ?? child.guardian2Email,
            guardianPhone: child.guardian2Phone ?? "",
            childNames: [],
          });
        }
        const entry = siteEntry.guardians.get(child.guardian2Email)!;
        if (!entry.childNames.includes(childName)) entry.childNames.push(childName);
      }
    }

    const result = Array.from(siteMap.entries())
      .sort(([, a], [, b]) => a.siteName.localeCompare(b.siteName))
      .map(([siteId, { siteName, guardians }]) => ({
        siteId,
        siteName,
        guardians: Array.from(guardians.values()).sort((a, b) =>
          a.guardianName.localeCompare(b.guardianName)
        ),
      }));

    res.json(result);
  } catch (err) {
    req.log.error({ err }, "Failed to fetch suspended guardians report");
    res.status(500).json({ error: "Failed to fetch report" });
  }
});

// ── Per-guardian financial endpoints ─────────────────────────────────────────

// GET /guardians/:email/financial — fetch status + logs + plans
router.get("/guardians/:email/financial", async (req, res): Promise<void> => {
  const email = decodeURIComponent(req.params.email ?? "");
  if (!email) { res.status(400).json({ error: "Email required" }); return; }

  try {
    const [account, communications, plans] = await Promise.all([
      getOrCreateAccount(email),
      db
        .select()
        .from(guardianCommunicationLogsTable)
        .where(eq(guardianCommunicationLogsTable.guardianEmail, email))
        .orderBy(desc(guardianCommunicationLogsTable.createdAt)),
      db
        .select()
        .from(guardianPaymentPlansTable)
        .where(eq(guardianPaymentPlansTable.guardianEmail, email))
        .orderBy(desc(guardianPaymentPlansTable.createdAt)),
    ]);

    res.json({
      status: account?.status ?? "active",
      communications,
      plans,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to fetch guardian financial data");
    res.status(500).json({ error: "Failed to fetch financial data" });
  }
});

// PATCH /guardians/:email/financial — update financial status
router.patch("/guardians/:email/financial", async (req, res): Promise<void> => {
  const email = decodeURIComponent(req.params.email ?? "");
  const { status } = req.body ?? {};
  if (!VALID_STATUSES.includes(status as FinancialStatus)) {
    res.status(400).json({ error: "Invalid status. Must be active, payment_plan, or suspended." });
    return;
  }
  try {
    await db
      .insert(guardianFinancialAccountsTable)
      .values({ guardianEmail: email, status, updatedAt: new Date() })
      .onConflictDoUpdate({
        target: [guardianFinancialAccountsTable.guardianEmail],
        set: { status, updatedAt: new Date() },
      });
    res.json({ status });
  } catch (err) {
    req.log.error({ err }, "Failed to update guardian financial status");
    res.status(500).json({ error: "Failed to update status" });
  }
});

// POST /guardians/:email/financial/communications — add a communication log entry
router.post("/guardians/:email/financial/communications", async (req, res): Promise<void> => {
  const email = decodeURIComponent(req.params.email ?? "");
  const { note, staffName } = req.body ?? {};
  if (!note?.trim()) { res.status(400).json({ error: "Note is required" }); return; }

  try {
    const [entry] = await db
      .insert(guardianCommunicationLogsTable)
      .values({
        guardianEmail: email,
        note: note.trim(),
        staffName: staffName?.trim() || null,
      })
      .returning();
    res.status(201).json(entry);
  } catch (err) {
    req.log.error({ err }, "Failed to create communication log");
    res.status(500).json({ error: "Failed to create entry" });
  }
});

// DELETE /guardians/:email/financial/communications/:id
router.delete(
  "/guardians/:email/financial/communications/:id",
  async (req, res): Promise<void> => {
    const email = decodeURIComponent(req.params.email ?? "");
    const id = parseInt(req.params.id ?? "", 10);
    if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

    try {
      await db
        .delete(guardianCommunicationLogsTable)
        .where(
          and(
            eq(guardianCommunicationLogsTable.id, id),
            eq(guardianCommunicationLogsTable.guardianEmail, email)
          )
        );
      res.sendStatus(204);
    } catch (err) {
      req.log.error({ err }, "Failed to delete communication log");
      res.status(500).json({ error: "Failed to delete entry" });
    }
  }
);

// POST /guardians/:email/financial/payment-plans — add a payment plan
router.post("/guardians/:email/financial/payment-plans", async (req, res): Promise<void> => {
  const email = decodeURIComponent(req.params.email ?? "");
  const { type, amount, frequency, description } = req.body ?? {};

  if (!["one_off", "recurring"].includes(type)) {
    res.status(400).json({ error: "Type must be one_off or recurring" }); return;
  }
  const parsedAmount = parseFloat(amount);
  if (isNaN(parsedAmount) || parsedAmount <= 0) {
    res.status(400).json({ error: "Amount must be a positive number" }); return;
  }
  if (type === "recurring" && !["weekly", "fortnightly", "monthly"].includes(frequency)) {
    res.status(400).json({ error: "Frequency must be weekly, fortnightly, or monthly for recurring plans" }); return;
  }

  try {
    const [plan] = await db
      .insert(guardianPaymentPlansTable)
      .values({
        guardianEmail: email,
        type,
        amount: String(parsedAmount),
        frequency: type === "recurring" ? frequency : null,
        description: description?.trim() || null,
      })
      .returning();
    res.status(201).json(plan);
  } catch (err) {
    req.log.error({ err }, "Failed to create payment plan");
    res.status(500).json({ error: "Failed to create plan" });
  }
});

// DELETE /guardians/:email/financial/payment-plans/:id
router.delete(
  "/guardians/:email/financial/payment-plans/:id",
  async (req, res): Promise<void> => {
    const email = decodeURIComponent(req.params.email ?? "");
    const id = parseInt(req.params.id ?? "", 10);
    if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

    try {
      await db
        .delete(guardianPaymentPlansTable)
        .where(
          and(
            eq(guardianPaymentPlansTable.id, id),
            eq(guardianPaymentPlansTable.guardianEmail, email)
          )
        );
      res.sendStatus(204);
    } catch (err) {
      req.log.error({ err }, "Failed to delete payment plan");
      res.status(500).json({ error: "Failed to delete plan" });
    }
  }
);

export default router;
