import { Router, type IRouter } from "express";
import { and, eq, asc, inArray, or } from "drizzle-orm";
import { guardianChildren, organisationId, tenantSiteIds } from "../lib/tenant";
import bcrypt from "bcryptjs";
import { randomBytes } from "crypto";
import { db, staffTable, parentAccountsTable, childrenTable, passwordResetTokensTable, sitesTable, schoolAccountsTable } from "@workspace/db";
import { sendLoginInstructionsEmail } from "../lib/email";
import { getEmailBranding } from "../lib/emailBranding";
import { getAppUrl } from "../lib/appUrl";
import { ensureSchoolAccount } from "../lib/schoolAccounts";
import { organisationRoutingQuery } from "../lib/accountOrganisation";

const router: IRouter = Router();

router.get("/reports/system-access", async (req, res): Promise<void> => {
  try {
    const provisionedSites = await db.select({ id: sitesTable.id, name: sitesTable.name }).from(sitesTable)
      .where(eq(sitesTable.orgId, organisationId(res))).orderBy(asc(sitesTable.name));
    await Promise.all(provisionedSites.map((site) => ensureSchoolAccount(site.id, site.name)));
    const [staffRows, guardianRows, childRows, siteRows, schoolRows] = await Promise.all([
      db.select().from(staffTable).where(and(eq(staffTable.status, "active"), eq(staffTable.organisationId, organisationId(res)))).orderBy(asc(staffTable.lastName), asc(staffTable.firstName)),
      db.select().from(parentAccountsTable).where(eq(parentAccountsTable.organisationId, organisationId(res))).orderBy(asc(parentAccountsTable.guardianEmail)),
      db.select({
        guardianEmail: childrenTable.guardianEmail,
        guardianName: childrenTable.guardianName,
        guardian2Email: childrenTable.guardian2Email,
        guardian2Name: childrenTable.guardian2Name,
        firstName: childrenTable.firstName,
        lastName: childrenTable.lastName,
        siteId: childrenTable.siteId,
      }).from(childrenTable).where(eq(childrenTable.organisationId, organisationId(res))),
      Promise.resolve(provisionedSites),
      db.select({
        id: schoolAccountsTable.id,
        siteId: schoolAccountsTable.siteId,
        siteName: sitesTable.name,
        username: schoolAccountsTable.username,
        passwordHash: schoolAccountsTable.passwordHash,
        blockedAt: schoolAccountsTable.blockedAt,
        lastLoginAt: schoolAccountsTable.lastLoginAt,
        createdAt: schoolAccountsTable.createdAt,
      }).from(schoolAccountsTable).innerJoin(sitesTable, eq(schoolAccountsTable.siteId, sitesTable.id))
        .where(eq(sitesTable.orgId, organisationId(res))).orderBy(asc(sitesTable.name)),
    ]);

    const guardianMeta = new Map<string, { email: string; name: string; children: string[]; siteIds: number[] }>();

    function indexGuardian(email: string | null, name: string | null, childName: string, siteId: number | null) {
      const key = (email ?? "").toLowerCase();
      if (!key) return;
      if (!guardianMeta.has(key)) {
        guardianMeta.set(key, { email: email!, name: name ?? key, children: [], siteIds: [] });
      }
      const entry = guardianMeta.get(key)!;
      entry.children.push(childName);
      if (siteId != null && !entry.siteIds.includes(siteId)) {
        entry.siteIds.push(siteId);
      }
    }

    for (const child of childRows) {
      const childName = `${child.firstName} ${child.lastName}`;
      indexGuardian(child.guardianEmail, child.guardianName, childName, child.siteId);
      indexGuardian(child.guardian2Email, child.guardian2Name, childName, child.siteId);
    }

    // Build a lookup from parent_accounts so we can enrich with connection/block status
    const accountMap = new Map<string, typeof guardianRows[0]>();
    for (const g of guardianRows) {
      accountMap.set(g.guardianEmail.toLowerCase(), g);
    }

    // Derive the list from children (every guardian email on a child record appears here),
    // then left-join parent_accounts — guardians without an account get id: null
    const guardians = Array.from(guardianMeta.entries())
      .map(([emailKey, meta]) => {
        const account = accountMap.get(emailKey);
        return {
          id: account?.id ?? null,
          guardianEmail: account?.guardianEmail ?? meta.email,
          guardianName: meta.name,
          children: meta.children,
          siteIds: meta.siteIds,
          isConnected: account ? !!account.passwordHash : false,
          blockedAt: account?.blockedAt ?? null,
          lastLoginAt: account?.lastLoginAt ?? null,
          createdAt: account?.createdAt ?? null,
        };
      })
      .sort((a, b) => a.guardianName.localeCompare(b.guardianName, undefined, { sensitivity: "base" }));

    const staff = staffRows.map((s) => ({
      id: s.id,
      firstName: s.firstName,
      lastName: s.lastName,
      email: s.email,
      role: s.role,
      status: s.status,
      isConnected: !!s.passwordHash,
      blockedAt: s.blockedAt,
      lastLoginAt: s.lastLoginAt,
      createdAt: s.createdAt,
    }));

    const schools = schoolRows.map(({ passwordHash, ...school }) => ({ ...school, isConnected: !!passwordHash }));
    res.json({ staff, guardians, schools, sites: siteRows });
  } catch (err) {
    req.log.error({ err }, "Failed to fetch system access report");
    res.status(500).json({ error: "Failed to fetch system access report" });
  }
});

// Block/unblock staff
router.patch("/reports/system-access/staff/:id/block", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  try {
    const scope = and(eq(staffTable.id, id), eq(staffTable.organisationId, organisationId(res)));
    const [current] = await db.select({ blockedAt: staffTable.blockedAt }).from(staffTable).where(scope);
    if (!current) { res.status(404).json({ error: "Staff not found" }); return; }
    const newVal = current.blockedAt ? null : new Date();
    const [updated] = await db.update(staffTable).set({ blockedAt: newVal as any }).where(scope).returning();
    res.json(updated);
  } catch (err) {
    req.log.error({ err, staffId: id }, "Failed to block/unblock staff");
    res.status(500).json({ error: "Failed to block/unblock staff" });
  }
});

// Block/unblock guardian
router.patch("/reports/system-access/guardian/:id/block", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  try {
    const scope = and(eq(parentAccountsTable.id, id), eq(parentAccountsTable.organisationId, organisationId(res)));
    const [current] = await db.select({ blockedAt: parentAccountsTable.blockedAt }).from(parentAccountsTable).where(scope);
    if (!current) { res.status(404).json({ error: "Guardian not found" }); return; }
    const newVal = current.blockedAt ? null : new Date();
    const [updated] = await db.update(parentAccountsTable).set({ blockedAt: newVal as any }).where(scope).returning();
    res.json(updated);
  } catch (err) {
    req.log.error({ err, guardianId: id }, "Failed to block/unblock guardian");
    res.status(500).json({ error: "Failed to block/unblock guardian" });
  }
});

router.patch("/reports/system-access/school/:id/block", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  try {
    const scope = and(eq(schoolAccountsTable.id, id), inArray(schoolAccountsTable.siteId, tenantSiteIds(organisationId(res))));
    const [current] = await db.select({ blockedAt: schoolAccountsTable.blockedAt }).from(schoolAccountsTable).where(scope);
    if (!current) { res.status(404).json({ error: "School account not found" }); return; }
    const [updated] = await db.update(schoolAccountsTable).set({ blockedAt: current.blockedAt ? null : new Date() }).where(scope).returning();
    res.json(updated);
  } catch (err) {
    req.log.error({ err, schoolAccountId: id }, "Failed to block/unblock school");
    res.status(500).json({ error: "Failed to update school access" });
  }
});

// Set password for staff
router.patch("/reports/system-access/staff/:id/set-password", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  const { password } = req.body ?? {};
  if (!password || String(password).length < 8) {
    res.status(400).json({ error: "Password must be at least 8 characters." });
    return;
  }
  try {
    const hash = await bcrypt.hash(String(password), 12);
    const [updated] = await db.update(staffTable).set({ passwordHash: hash })
      .where(and(eq(staffTable.id, id), eq(staffTable.organisationId, organisationId(res)))).returning();
    if (!updated) { res.status(404).json({ error: "Staff not found" }); return; }
    res.json({ ok: true });
  } catch (err) {
    req.log.error({ err, staffId: id }, "Failed to set staff password");
    res.status(500).json({ error: "Failed to set staff password" });
  }
});

// Set password for guardian
router.patch("/reports/system-access/guardian/:id/set-password", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  const { password } = req.body ?? {};
  if (!password || String(password).length < 8) {
    res.status(400).json({ error: "Password must be at least 8 characters." });
    return;
  }
  try {
    const hash = await bcrypt.hash(String(password), 12);
    const [updated] = await db.update(parentAccountsTable).set({ passwordHash: hash })
      .where(and(eq(parentAccountsTable.id, id), eq(parentAccountsTable.organisationId, organisationId(res)))).returning();
    if (!updated) { res.status(404).json({ error: "Guardian not found" }); return; }
    res.json({ ok: true });
  } catch (err) {
    req.log.error({ err, guardianId: id }, "Failed to set guardian password");
    res.status(500).json({ error: "Failed to set guardian password" });
  }
});

router.patch("/reports/system-access/school/:id/set-password", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  const { password } = req.body ?? {};
  if (!password || String(password).length < 8) { res.status(400).json({ error: "Password must be at least 8 characters." }); return; }
  try {
    const hash = await bcrypt.hash(String(password), 12);
    const [updated] = await db.update(schoolAccountsTable).set({ passwordHash: hash })
      .where(and(eq(schoolAccountsTable.id, id), inArray(schoolAccountsTable.siteId, tenantSiteIds(organisationId(res))))).returning();
    if (!updated) { res.status(404).json({ error: "School account not found" }); return; }
    res.json({ ok: true });
  } catch (err) {
    req.log.error({ err, schoolAccountId: id }, "Failed to set school password");
    res.status(500).json({ error: "Failed to set school password" });
  }
});

router.patch("/reports/system-access/school/:id/username", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  const username = String(req.body?.username ?? "").trim().toLowerCase();
  if (!/^[a-z0-9][a-z0-9._-]{2,63}$/.test(username)) {
    res.status(400).json({ error: "Use 3–64 lowercase letters, numbers, dots, dashes, or underscores." }); return;
  }
  try {
    const [updated] = await db.update(schoolAccountsTable).set({ username })
      .where(and(eq(schoolAccountsTable.id, id), inArray(schoolAccountsTable.siteId, tenantSiteIds(organisationId(res))))).returning();
    if (!updated) { res.status(404).json({ error: "School account not found" }); return; }
    res.json({ ok: true, username });
  } catch (err) {
    req.log.error({ err, schoolAccountId: id }, "Failed to update school username");
    res.status(409).json({ error: "That username is already in use." });
  }
});

const ADMIN_ROLES = new Set(["director", "admin", "admin_support", "coordinator", "educational_leader"]);

function requireAdminStaff(req: any, res: any): boolean {
  const user = req.session?.user;
  if (!user || user.type !== "staff" || !ADMIN_ROLES.has(user.role)) {
    res.status(403).json({ error: "Only centre administrators can send login instructions." });
    return false;
  }
  return true;
}

function isSmtpConfigured(): boolean {
  return !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
}

function getBaseUrl(): string {
  return getAppUrl();
}

async function createResetToken(email: string, userType: "staff" | "guardian", organisationId: number, accountId: number): Promise<string> {
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 4 * 60 * 60 * 1000);
  await db.insert(passwordResetTokensTable).values({ token, email, userType, expiresAt, organisationId, accountId });
  return token;
}

// Send login instructions to a staff member
router.post("/reports/system-access/staff/:id/send-instructions", async (req, res): Promise<void> => {
  if (!requireAdminStaff(req, res)) return;

  if (!isSmtpConfigured()) {
    res.status(503).json({ error: "Email delivery is not configured. Ask your administrator to set up SMTP." });
    return;
  }

  const id = Number(req.params.id);
  try {
    const [staff] = await db
      .select({ id: staffTable.id, firstName: staffTable.firstName, lastName: staffTable.lastName, email: staffTable.email, blockedAt: staffTable.blockedAt, passwordHash: staffTable.passwordHash })
      .from(staffTable)
      .where(and(eq(staffTable.id, id), eq(staffTable.organisationId, organisationId(res))));

    if (!staff) {
      res.status(404).json({ error: "Staff member not found." });
      return;
    }
    if (!staff.email) {
      res.status(400).json({ error: "This staff member has no email address on record." });
      return;
    }
    if (staff.blockedAt) {
      res.status(400).json({ error: "This account is blocked. Unblock it before sending login instructions." });
      return;
    }

    const baseUrl = getBaseUrl();
    const token = await createResetToken(staff.email.toLowerCase(), "staff", organisationId(res), staff.id);
    const query = await organisationRoutingQuery(organisationId(res));
    const setPasswordUrl = `${baseUrl}/reset-password?token=${token}${query ? `&${query}` : ""}`;
    const loginUrl = `${baseUrl}/login${query ? `?${query}` : ""}`;

    try {
      const branding = await getEmailBranding(organisationId(res));
      await sendLoginInstructionsEmail(staff.email, {
        recipientName: `${staff.firstName} ${staff.lastName}`,
        loginEmail: staff.email,
        loginUrl,
        setPasswordUrl,
        isAlreadyConnected: !!staff.passwordHash,
        accountType: "staff",
      }, branding);
    } catch (err) {
      req.log.error({ err, staffId: id }, "Failed to send login instructions email");
      res.status(500).json({ error: "Failed to send email. Please try again later." });
      return;
    }

    res.json({ ok: true });
  } catch (err) {
    req.log.error({ err, staffId: id }, "Failed to send staff login instructions");
    res.status(500).json({ error: "Failed to send staff login instructions" });
  }
});

// Provision a guardian account (if needed) and send login instructions — used for "No account" rows
router.post("/reports/system-access/guardian/provision-and-send", async (req, res): Promise<void> => {
  if (!requireAdminStaff(req, res)) return;

  if (!isSmtpConfigured()) {
    res.status(503).json({ error: "Email delivery is not configured. Ask your administrator to set up SMTP." });
    return;
  }

  const { email } = req.body ?? {};
  if (!email || typeof email !== "string") {
    res.status(400).json({ error: "Email is required." });
    return;
  }
  const normalised = email.toLowerCase().trim();

  try {
    // Look up guardian name from children records
    const [childRow] = await db
      .select({
        guardianEmail: childrenTable.guardianEmail,
        guardianName: childrenTable.guardianName,
        guardian2Email: childrenTable.guardian2Email,
        guardian2Name: childrenTable.guardian2Name,
      })
      .from(childrenTable)
      .where(guardianChildren(organisationId(res), normalised))
      .limit(1);

    if (!childRow) {
      res.status(404).json({ error: "No child record found for this guardian email." });
      return;
    }

    const recipientName = childRow.guardian2Email?.toLowerCase() === normalised
      ? (childRow.guardian2Name ?? normalised)
      : (childRow.guardianName ?? normalised);

    // Upsert: create account if it doesn't exist yet
    await db
      .insert(parentAccountsTable)
      .values({ guardianEmail: normalised, organisationId: organisationId(res) })
      .onConflictDoNothing({ target: [parentAccountsTable.organisationId, parentAccountsTable.guardianEmail] });
    const [account] = await db.select({ id: parentAccountsTable.id }).from(parentAccountsTable)
      .where(and(eq(parentAccountsTable.guardianEmail, normalised), eq(parentAccountsTable.organisationId, organisationId(res))));
    if (!account) { res.status(409).json({ error: "Unable to provision this account" }); return; }

    const baseUrl = getBaseUrl();
    const token = await createResetToken(normalised, "guardian", organisationId(res), account.id);
    const query = await organisationRoutingQuery(organisationId(res));
    const setPasswordUrl = `${baseUrl}/reset-password?token=${token}${query ? `&${query}` : ""}`;
    const loginUrl = `${baseUrl}/login${query ? `?${query}` : ""}`;

    try {
      const branding = await getEmailBranding(organisationId(res));
      await sendLoginInstructionsEmail(normalised, {
        recipientName,
        loginEmail: normalised,
        loginUrl,
        setPasswordUrl,
        isAlreadyConnected: false,
        accountType: "guardian",
      }, branding);
    } catch (err) {
      req.log.error({ err, email: normalised }, "Failed to send login instructions email");
      res.status(500).json({ error: "Failed to send email. Please try again later." });
      return;
    }

    res.json({ ok: true });
  } catch (err) {
    req.log.error({ err, email: normalised }, "Failed to provision and send guardian instructions");
    res.status(500).json({ error: "Failed to provision and send guardian instructions" });
  }
});

// Send login instructions to a guardian
router.post("/reports/system-access/guardian/:id/send-instructions", async (req, res): Promise<void> => {
  if (!requireAdminStaff(req, res)) return;

  if (!isSmtpConfigured()) {
    res.status(503).json({ error: "Email delivery is not configured. Ask your administrator to set up SMTP." });
    return;
  }

  const id = Number(req.params.id);
  try {
    const [guardian] = await db
      .select({ id: parentAccountsTable.id, guardianEmail: parentAccountsTable.guardianEmail, blockedAt: parentAccountsTable.blockedAt, passwordHash: parentAccountsTable.passwordHash })
      .from(parentAccountsTable)
      .where(and(eq(parentAccountsTable.id, id), eq(parentAccountsTable.organisationId, organisationId(res))));

    if (!guardian) {
      res.status(404).json({ error: "Guardian account not found." });
      return;
    }
    if (!guardian.guardianEmail) {
      res.status(400).json({ error: "This guardian has no email address on record." });
      return;
    }
    if (guardian.blockedAt) {
      res.status(400).json({ error: "This account is blocked. Unblock it before sending login instructions." });
      return;
    }

    // Look up guardian name — check primary and secondary guardian email
    const gEmail = guardian.guardianEmail.toLowerCase();
    const [childRow] = await db
      .select({
        guardianEmail: childrenTable.guardianEmail,
        guardianName: childrenTable.guardianName,
        guardian2Email: childrenTable.guardian2Email,
        guardian2Name: childrenTable.guardian2Name,
      })
      .from(childrenTable)
      .where(guardianChildren(organisationId(res), gEmail))
      .limit(1);

    const recipientName = childRow
      ? (childRow.guardian2Email?.toLowerCase() === gEmail
          ? childRow.guardian2Name
          : childRow.guardianName) ?? gEmail
      : gEmail;

    const baseUrl = getBaseUrl();
    const token = await createResetToken(guardian.guardianEmail.toLowerCase(), "guardian", organisationId(res), guardian.id);
    const query = await organisationRoutingQuery(organisationId(res));
    const setPasswordUrl = `${baseUrl}/reset-password?token=${token}${query ? `&${query}` : ""}`;
    const loginUrl = `${baseUrl}/login${query ? `?${query}` : ""}`;

    try {
      const branding = await getEmailBranding(organisationId(res));
      await sendLoginInstructionsEmail(guardian.guardianEmail, {
        recipientName,
        loginEmail: guardian.guardianEmail,
        loginUrl,
        setPasswordUrl,
        isAlreadyConnected: !!guardian.passwordHash,
        accountType: "guardian",
      }, branding);
    } catch (err) {
      req.log.error({ err, guardianId: id }, "Failed to send login instructions email");
      res.status(500).json({ error: "Failed to send email. Please try again later." });
      return;
    }

    res.json({ ok: true });
  } catch (err) {
    req.log.error({ err, guardianId: id }, "Failed to send guardian login instructions");
    res.status(500).json({ error: "Failed to send guardian login instructions" });
  }
});

export default router;
