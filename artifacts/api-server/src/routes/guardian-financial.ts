import { Router, type IRouter, type Request, type Response } from "express";
import { eq, and, inArray, desc, or, sql, lt } from "drizzle-orm";
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

function requireAdmin(req: Request, res: Response): boolean {
  const user = req.session?.user;
  if (!user || user.type !== "staff" || user.role !== "admin") {
    res.status(403).json({ error: "Admin access required" });
    return false;
  }
  return true;
}

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

// ── On the Radar report (payment_plan status) ─────────────────────────────────
// NOTE: Must stay before /:email routes.
router.get("/guardians/financial/on-radar", async (req, res): Promise<void> => {
  const siteIdParam = req.query.siteId ? parseInt(req.query.siteId as string, 10) : null;

  try {
    const radarAccounts = await db
      .select()
      .from(guardianFinancialAccountsTable)
      .where(eq(guardianFinancialAccountsTable.status, "payment_plan"));

    if (radarAccounts.length === 0) {
      res.json([]);
      return;
    }

    const radarEmails = radarAccounts.map((a) => a.guardianEmail);

    const [childrenByPrimary, childrenBySecondary, allPlans, allSites, latestComms] = await Promise.all([
      db.select().from(childrenTable).where(inArray(childrenTable.guardianEmail, radarEmails)),
      db.select().from(childrenTable).where(inArray(childrenTable.guardian2Email, radarEmails)),
      db
        .select()
        .from(guardianPaymentPlansTable)
        .where(inArray(guardianPaymentPlansTable.guardianEmail, radarEmails))
        .orderBy(desc(guardianPaymentPlansTable.createdAt)),
      db.select().from(sitesTable).where(eq(sitesTable.status, "active")),
      db
        .select()
        .from(guardianCommunicationLogsTable)
        .where(inArray(guardianCommunicationLogsTable.guardianEmail, radarEmails))
        .orderBy(desc(guardianCommunicationLogsTable.createdAt)),
    ]);

    // Merge child lists, de-duplicating by id
    const childMap = new Map<number, (typeof childrenByPrimary)[number]>();
    for (const c of [...childrenByPrimary, ...childrenBySecondary]) childMap.set(c.id, c);
    const allChildren = Array.from(childMap.values());

    // Index plans by guardian email
    const plansByEmail = new Map<string, (typeof allPlans)>();
    for (const plan of allPlans) {
      const list = plansByEmail.get(plan.guardianEmail) ?? [];
      list.push(plan);
      plansByEmail.set(plan.guardianEmail, list);
    }

    // Index most-recent comm by guardian email (already ordered desc, first match wins)
    const latestCommByEmail = new Map<string, (typeof latestComms)[number]>();
    for (const comm of latestComms) {
      if (!latestCommByEmail.has(comm.guardianEmail)) {
        latestCommByEmail.set(comm.guardianEmail, comm);
      }
    }

    // Index reasoning by guardian email
    const reasoningByEmail = new Map<string, string | null>();
    for (const acct of radarAccounts) {
      reasoningByEmail.set(acct.guardianEmail, acct.reasoning ?? null);
    }

    type GuardianEntry = {
      guardianEmail: string;
      guardianName: string;
      guardianPhone: string;
      reasoning: string | null;
      lastComm: { note: string; staffName: string | null; createdAt: string } | null;
      plans: (typeof allPlans);
    };

    const siteMap = new Map<number, { siteName: string; guardians: Map<string, GuardianEntry> }>();

    for (const child of allChildren) {
      if (!child.siteId) continue;
      const site = allSites.find((s) => s.id === child.siteId);
      if (!site) continue;
      if (siteIdParam !== null && site.id !== siteIdParam) continue;

      if (!siteMap.has(site.id)) siteMap.set(site.id, { siteName: site.name, guardians: new Map() });
      const siteEntry = siteMap.get(site.id)!;

      // Primary guardian
      if (child.guardianEmail && radarEmails.includes(child.guardianEmail)) {
        if (!siteEntry.guardians.has(child.guardianEmail)) {
          const lc = latestCommByEmail.get(child.guardianEmail) ?? null;
          siteEntry.guardians.set(child.guardianEmail, {
            guardianEmail: child.guardianEmail,
            guardianName: child.guardianName,
            guardianPhone: child.guardianPhone,
            reasoning: reasoningByEmail.get(child.guardianEmail) ?? null,
            lastComm: lc ? { note: lc.note, staffName: lc.staffName, createdAt: lc.createdAt.toISOString() } : null,
            plans: plansByEmail.get(child.guardianEmail) ?? [],
          });
        }
      }

      // Secondary guardian
      if (child.guardian2Email && radarEmails.includes(child.guardian2Email)) {
        if (!siteEntry.guardians.has(child.guardian2Email)) {
          const lc = latestCommByEmail.get(child.guardian2Email) ?? null;
          siteEntry.guardians.set(child.guardian2Email, {
            guardianEmail: child.guardian2Email,
            guardianName: child.guardian2Name ?? child.guardian2Email,
            guardianPhone: child.guardian2Phone ?? "",
            reasoning: reasoningByEmail.get(child.guardian2Email) ?? null,
            lastComm: lc ? { note: lc.note, staffName: lc.staffName, createdAt: lc.createdAt.toISOString() } : null,
            plans: plansByEmail.get(child.guardian2Email) ?? [],
          });
        }
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
    req.log.error({ err }, "Failed to fetch on-radar report");
    res.status(500).json({ error: "Failed to fetch report" });
  }
});

// ── Guardian communication log report (admins only) ───────────────────────────
const COMMUNICATION_LOG_DEFAULT_PAGE_SIZE = 25;
const COMMUNICATION_LOG_MAX_PAGE_SIZE = 100;

function parsePaginationQueryParam(value: unknown, fallback: number): number {
  if (value === undefined) return fallback;
  if (typeof value !== "string" || !/^\d+$/.test(value)) return Number.NaN;
  return Number(value);
}

type CommunicationLogCursor = {
  createdAt: Date;
  id: number;
};

function parseCommunicationLogCursor(value: unknown): CommunicationLogCursor | null | undefined {
  if (value === undefined) return null;
  if (typeof value !== "string" || !value) return undefined;

  try {
    const decoded = JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as {
      createdAt?: unknown;
      id?: unknown;
    };
    const createdAt = typeof decoded.createdAt === "string"
      ? new Date(decoded.createdAt)
      : new Date(Number.NaN);
    if (
      Number.isNaN(createdAt.getTime()) ||
      !Number.isInteger(decoded.id) ||
      Number(decoded.id) <= 0
    ) {
      return undefined;
    }
    return { createdAt, id: Number(decoded.id) };
  } catch {
    return undefined;
  }
}

function encodeCommunicationLogCursor(
  communication: { createdAt: Date; id: number },
): string {
  return Buffer.from(JSON.stringify({
    createdAt: communication.createdAt.toISOString(),
    id: communication.id,
  })).toString("base64url");
}

router.get("/guardians/financial/communication-log", async (req, res): Promise<void> => {
  if (!requireAdmin(req, res)) return;

  const siteIdParam = req.query.siteId ? parseInt(req.query.siteId as string, 10) : null;
  if (siteIdParam !== null && (!Number.isInteger(siteIdParam) || siteIdParam <= 0)) {
    res.status(400).json({ error: "Invalid site id" });
    return;
  }

  const pageSizeParam = parsePaginationQueryParam(
    req.query.pageSize,
    COMMUNICATION_LOG_DEFAULT_PAGE_SIZE,
  );
  const cursor = parseCommunicationLogCursor(req.query.cursor);
  if (
    !Number.isInteger(pageSizeParam) ||
    pageSizeParam < 1 ||
    pageSizeParam > COMMUNICATION_LOG_MAX_PAGE_SIZE ||
    cursor === undefined
  ) {
    res.status(400).json({ error: "Invalid pagination parameters" });
    return;
  }

  try {
    // Resolve the site filter to guardian emails before querying the logs so
    // every cursor page remains scoped at the database level.
    let siteGuardianEmails: string[] | null = null;
    if (siteIdParam !== null) {
      const siteChildren = await db
        .select({
          guardianEmail: childrenTable.guardianEmail,
          guardian2Email: childrenTable.guardian2Email,
        })
        .from(childrenTable)
        .where(eq(childrenTable.siteId, siteIdParam));

      siteGuardianEmails = [
        ...new Set(
          siteChildren
            .flatMap((child) => [child.guardianEmail, child.guardian2Email])
            .filter((email): email is string => Boolean(email))
            .map((email) => email.trim().toLowerCase())
            .filter(Boolean),
        ),
      ];

      if (siteGuardianEmails.length === 0) {
        res.json({
          entries: [],
          pagination: {
            pageSize: pageSizeParam,
            hasNextPage: false,
            nextCursor: null,
          },
        });
        return;
      }
    }

    const communicationFilter =
      siteGuardianEmails === null
        ? null
        : sql`lower(trim(${guardianCommunicationLogsTable.guardianEmail})) in (${sql.join(
            siteGuardianEmails.map((email) => sql`${email}`),
            sql`, `,
          )})`;

    const cursorFilter = cursor
      ? or(
          lt(guardianCommunicationLogsTable.createdAt, cursor.createdAt),
          and(
            eq(guardianCommunicationLogsTable.createdAt, cursor.createdAt),
            lt(guardianCommunicationLogsTable.id, cursor.id),
          ),
        )
      : null;
    const combinedFilter = communicationFilter && cursorFilter
      ? and(communicationFilter, cursorFilter)
      : communicationFilter ?? cursorFilter;

    const communicationsQuery = combinedFilter
      ? db
          .select()
          .from(guardianCommunicationLogsTable)
          .where(combinedFilter)
          .orderBy(
            desc(guardianCommunicationLogsTable.createdAt),
            desc(guardianCommunicationLogsTable.id),
          )
          .limit(pageSizeParam + 1)
      : db
          .select()
          .from(guardianCommunicationLogsTable)
          .orderBy(
            desc(guardianCommunicationLogsTable.createdAt),
            desc(guardianCommunicationLogsTable.id),
          )
          .limit(pageSizeParam + 1);

    const [communicationsWithLookahead, sites] = await Promise.all([
      communicationsQuery,
      db.select().from(sitesTable).where(eq(sitesTable.status, "active")),
    ]);
    const hasNextPage = communicationsWithLookahead.length > pageSizeParam;
    const communications = communicationsWithLookahead.slice(0, pageSizeParam);
    const nextCursor = hasNextPage && communications.length > 0
      ? encodeCommunicationLogCursor(communications[communications.length - 1])
      : null;

    if (communications.length === 0) {
      res.json({
        entries: [],
        pagination: {
          pageSize: pageSizeParam,
          hasNextPage: false,
          nextCursor: null,
        },
      });
      return;
    }

    const communicationEmails = [
      ...new Set(
        communications
          .map((communication) => communication.guardianEmail.trim().toLowerCase())
          .filter(Boolean),
      ),
    ];
    const children = await db
      .select()
      .from(childrenTable)
      .where(
        or(
          sql`lower(trim(${childrenTable.guardianEmail})) in (${sql.join(
            communicationEmails.map((email) => sql`${email}`),
            sql`, `,
          )})`,
          sql`lower(trim(${childrenTable.guardian2Email})) in (${sql.join(
            communicationEmails.map((email) => sql`${email}`),
            sql`, `,
          )})`,
        ),
      );

    const sitesById = new Map(sites.map((site) => [site.id, site]));
    const guardianContext = new Map<
      string,
      {
        guardianName: string | null;
        childNames: Set<string>;
        childNamesBySite: Map<number, Set<string>>;
        siteIds: Set<number>;
        siteNames: Set<string>;
      }
    >();

    function addGuardianContext(
      email: string | null | undefined,
      guardianName: string | null | undefined,
      childName: string,
      siteId: number | null,
      siteName: string | null,
    ) {
      if (!email) return;
      const key = email.trim().toLowerCase();
      if (!key) return;

      const context = guardianContext.get(key) ?? {
        guardianName: null,
        childNames: new Set<string>(),
        childNamesBySite: new Map<number, Set<string>>(),
        siteIds: new Set<number>(),
        siteNames: new Set<string>(),
      };
      if (!context.guardianName && guardianName) context.guardianName = guardianName;
      context.childNames.add(childName);
      if (siteId !== null) {
        context.siteIds.add(siteId);
        const siteChildNames = context.childNamesBySite.get(siteId) ?? new Set<string>();
        siteChildNames.add(childName);
        context.childNamesBySite.set(siteId, siteChildNames);
      }
      if (siteName) context.siteNames.add(siteName);
      guardianContext.set(key, context);
    }

    for (const child of children) {
      const site = child.siteId ? sitesById.get(child.siteId) : undefined;
      const childName = `${child.firstName} ${child.lastName}`;
      addGuardianContext(
        child.guardianEmail,
        child.guardianName,
        childName,
        child.siteId,
        site?.name ?? null,
      );
      addGuardianContext(
        child.guardian2Email,
        child.guardian2Name ?? child.guardian2Email,
        childName,
        child.siteId,
        site?.name ?? null,
      );
    }

    const result = communications.flatMap((communication) => {
      const context = guardianContext.get(communication.guardianEmail.trim().toLowerCase());
      if (siteIdParam !== null && !context?.siteIds.has(siteIdParam)) return [];

      return [{
        id: communication.id,
        guardianEmail: communication.guardianEmail,
        guardianName: context?.guardianName ?? communication.guardianEmail,
        childNames: context
          ? Array.from(
              siteIdParam === null
                ? context.childNames
                : context.childNamesBySite.get(siteIdParam) ?? [],
            ).sort()
          : [],
        siteNames: context
          ? Array.from(
              siteIdParam === null
                ? context.siteNames
                : sitesById.get(siteIdParam)?.name
                  ? [sitesById.get(siteIdParam)!.name]
                  : [],
            ).sort()
          : [],
        note: communication.note,
        staffName: communication.staffName,
        createdAt: communication.createdAt,
      }];
    });

    res.json({
      entries: result,
      pagination: {
        pageSize: pageSizeParam,
        hasNextPage,
        nextCursor,
      },
    });
  } catch (err) {
    req.log.error({ err }, "Failed to fetch guardian communication log report");
    res.status(500).json({ error: "Failed to fetch communication log" });
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
      reasoning: account?.reasoning ?? null,
      communications,
      plans,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to fetch guardian financial data");
    res.status(500).json({ error: "Failed to fetch financial data" });
  }
});

// PATCH /guardians/:email/financial — update financial status + reasoning
router.patch("/guardians/:email/financial", async (req, res): Promise<void> => {
  const email = decodeURIComponent(req.params.email ?? "");
  const { status, reasoning } = req.body ?? {};
  if (!VALID_STATUSES.includes(status as FinancialStatus)) {
    res.status(400).json({ error: "Invalid status. Must be active, payment_plan, or suspended." });
    return;
  }
  const reasoningValue = reasoning?.trim() || null;
  try {
    await db
      .insert(guardianFinancialAccountsTable)
      .values({ guardianEmail: email, status, reasoning: reasoningValue, updatedAt: new Date() })
      .onConflictDoUpdate({
        target: [guardianFinancialAccountsTable.guardianEmail],
        set: { status, reasoning: reasoningValue, updatedAt: new Date() },
      });
    res.json({ status, reasoning: reasoningValue });
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
  const { type, amount, frequency, description, expectedDate, startDate, endDate } = req.body ?? {};

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
        expectedDate: type === "one_off" && expectedDate ? String(expectedDate) : null,
        startDate: startDate ? String(startDate) : null,
        endDate: endDate ? String(endDate) : null,
      })
      .returning();
    res.status(201).json(plan);
  } catch (err) {
    req.log.error({ err }, "Failed to create payment plan");
    res.status(500).json({ error: "Failed to create plan" });
  }
});

// PATCH /guardians/:email/financial/payment-plans/:id — toggle received state
router.patch(
  "/guardians/:email/financial/payment-plans/:id",
  async (req, res): Promise<void> => {
    const email = decodeURIComponent(req.params.email ?? "");
    const id = parseInt(req.params.id ?? "", 10);
    if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

    const { received } = req.body ?? {};
    try {
      await db
        .update(guardianPaymentPlansTable)
        .set({ receivedAt: received ? new Date() : null })
        .where(
          and(
            eq(guardianPaymentPlansTable.id, id),
            eq(guardianPaymentPlansTable.guardianEmail, email)
          )
        );
      res.json({ ok: true });
    } catch (err) {
      req.log.error({ err }, "Failed to update payment plan received state");
      res.status(500).json({ error: "Failed to update plan" });
    }
  }
);

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
