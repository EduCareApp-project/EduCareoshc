import { Router, type IRouter } from "express";
import { eq, asc, or } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { randomBytes } from "crypto";
import { db, staffTable, parentAccountsTable, childrenTable, passwordResetTokensTable, sitesTable } from "@workspace/db";
import { sendLoginInstructionsEmail } from "../lib/email";
import { getEmailBranding } from "../lib/emailBranding";

const router: IRouter = Router();

router.get("/reports/system-access", async (_req, res): Promise<void> => {
  const [staffRows, guardianRows, childRows, siteRows] = await Promise.all([
    db.select().from(staffTable).orderBy(asc(staffTable.lastName), asc(staffTable.firstName)),
    db.select().from(parentAccountsTable).orderBy(asc(parentAccountsTable.guardianEmail)),
    db.select({
      guardianEmail: childrenTable.guardianEmail,
      guardianName: childrenTable.guardianName,
      firstName: childrenTable.firstName,
      lastName: childrenTable.lastName,
      siteId: childrenTable.siteId,
    }).from(childrenTable),
    db.select({ id: sitesTable.id, name: sitesTable.name }).from(sitesTable).orderBy(asc(sitesTable.name)),
  ]);

  const guardianMeta = new Map<string, { name: string; children: string[]; siteIds: number[] }>();
  for (const child of childRows) {
    const email = (child.guardianEmail ?? "").toLowerCase();
    if (!email) continue;
    if (!guardianMeta.has(email)) {
      guardianMeta.set(email, { name: child.guardianName ?? email, children: [], siteIds: [] });
    }
    const entry = guardianMeta.get(email)!;
    entry.children.push(`${child.firstName} ${child.lastName}`);
    if (child.siteId != null && !entry.siteIds.includes(child.siteId)) {
      entry.siteIds.push(child.siteId);
    }
  }

  const guardians = guardianRows
    .map((g) => {
      const meta = guardianMeta.get(g.guardianEmail.toLowerCase());
      return {
        id: g.id,
        guardianEmail: g.guardianEmail,
        guardianName: meta?.name ?? g.guardianEmail,
        children: meta?.children ?? [],
        siteIds: meta?.siteIds ?? [],
        isConnected: !!g.passwordHash,
        blockedAt: g.blockedAt,
        lastLoginAt: g.lastLoginAt,
        createdAt: g.createdAt,
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

  res.json({ staff, guardians, sites: siteRows });
});

// Block/unblock staff
router.patch("/reports/system-access/staff/:id/block", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  const [current] = await db.select({ blockedAt: staffTable.blockedAt }).from(staffTable).where(eq(staffTable.id, id));
  if (!current) { res.status(404).json({ error: "Staff not found" }); return; }
  const newVal = current.blockedAt ? null : new Date();
  const [updated] = await db.update(staffTable).set({ blockedAt: newVal as any }).where(eq(staffTable.id, id)).returning();
  res.json(updated);
});

// Block/unblock guardian
router.patch("/reports/system-access/guardian/:id/block", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  const [current] = await db.select({ blockedAt: parentAccountsTable.blockedAt }).from(parentAccountsTable).where(eq(parentAccountsTable.id, id));
  if (!current) { res.status(404).json({ error: "Guardian not found" }); return; }
  const newVal = current.blockedAt ? null : new Date();
  const [updated] = await db.update(parentAccountsTable).set({ blockedAt: newVal as any }).where(eq(parentAccountsTable.id, id)).returning();
  res.json(updated);
});

// Set password for staff
router.patch("/reports/system-access/staff/:id/set-password", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  const { password } = req.body ?? {};
  if (!password || String(password).length < 8) {
    res.status(400).json({ error: "Password must be at least 8 characters." });
    return;
  }
  const hash = await bcrypt.hash(String(password), 12);
  const [updated] = await db.update(staffTable).set({ passwordHash: hash }).where(eq(staffTable.id, id)).returning();
  if (!updated) { res.status(404).json({ error: "Staff not found" }); return; }
  res.json({ ok: true });
});

// Set password for guardian
router.patch("/reports/system-access/guardian/:id/set-password", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  const { password } = req.body ?? {};
  if (!password || String(password).length < 8) {
    res.status(400).json({ error: "Password must be at least 8 characters." });
    return;
  }
  const hash = await bcrypt.hash(String(password), 12);
  const [updated] = await db.update(parentAccountsTable).set({ passwordHash: hash }).where(eq(parentAccountsTable.id, id)).returning();
  if (!updated) { res.status(404).json({ error: "Guardian not found" }); return; }
  res.json({ ok: true });
});

const ADMIN_ROLES = new Set(["director", "admin", "coordinator", "educational_leader"]);

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
  const domains = (process.env.REPLIT_DOMAINS ?? process.env.REPLIT_DEV_DOMAIN ?? "localhost").split(",");
  return `https://${domains[0]}`;
}

async function createResetToken(email: string, userType: "staff" | "guardian"): Promise<string> {
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 4 * 60 * 60 * 1000);
  await db.insert(passwordResetTokensTable).values({ token, email, userType, expiresAt });
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
  const [staff] = await db
    .select({ id: staffTable.id, firstName: staffTable.firstName, lastName: staffTable.lastName, email: staffTable.email, blockedAt: staffTable.blockedAt, passwordHash: staffTable.passwordHash })
    .from(staffTable)
    .where(eq(staffTable.id, id));

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
  const token = await createResetToken(staff.email.toLowerCase(), "staff");
  const setPasswordUrl = `${baseUrl}/reset-password?token=${token}`;
  const loginUrl = `${baseUrl}/login`;

  try {
    const branding = await getEmailBranding();
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
});

// Send login instructions to a guardian
router.post("/reports/system-access/guardian/:id/send-instructions", async (req, res): Promise<void> => {
  if (!requireAdminStaff(req, res)) return;

  if (!isSmtpConfigured()) {
    res.status(503).json({ error: "Email delivery is not configured. Ask your administrator to set up SMTP." });
    return;
  }

  const id = Number(req.params.id);
  const [guardian] = await db
    .select({ id: parentAccountsTable.id, guardianEmail: parentAccountsTable.guardianEmail, blockedAt: parentAccountsTable.blockedAt, passwordHash: parentAccountsTable.passwordHash })
    .from(parentAccountsTable)
    .where(eq(parentAccountsTable.id, id));

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
    .where(
      or(
        eq(childrenTable.guardianEmail, gEmail),
        eq(childrenTable.guardian2Email, gEmail),
      )
    )
    .limit(1);

  const recipientName = childRow
    ? (childRow.guardian2Email?.toLowerCase() === gEmail
        ? childRow.guardian2Name
        : childRow.guardianName) ?? gEmail
    : gEmail;

  const baseUrl = getBaseUrl();
  const token = await createResetToken(guardian.guardianEmail.toLowerCase(), "guardian");
  const setPasswordUrl = `${baseUrl}/reset-password?token=${token}`;
  const loginUrl = `${baseUrl}/login`;

  try {
    const branding = await getEmailBranding();
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
});

export default router;
