import { Router, type IRouter } from "express";
import emergencyHeadingPreferencesRouter from "./emergency-heading-preferences";
import bcrypt from "bcryptjs";
import { randomBytes } from "crypto";
import { eq, asc, and, or, gt, isNull, isNotNull, inArray, sql, ne } from "drizzle-orm";
import { db, systemDb, withOrganisationContext, staffTable, parentAccountsTable, childrenTable, passwordResetTokensTable, postsTable, sitesTable, planningExperiencesTable, noticesTable, guardianLoginLogsTable, schoolAccountsTable } from "@workspace/db";
import { sendPasswordResetEmail } from "../lib/email";
import { getEmailBranding } from "../lib/emailBranding";
import { getAppUrl } from "../lib/appUrl";
import { organisationContext } from "../middlewares/organisation-context";
import { guardianChildren, organisationId, tenantStaffIds } from "../lib/tenant";
import { organisationRoutingQuery, resolveAccountOrganisation } from "../lib/accountOrganisation";

const router: IRouter = Router();
// Credential entry points are public. Every account-backed endpoint, including
// /auth/me, must re-read membership just like the main protected router.
const publicAuthPaths = new Set(["/auth/login", "/auth/logout", "/auth/forgot-password", "/auth/reset-password"]);
router.use(async (req, _res, next) => {
  try {
    if (req.path === "/auth/login" || req.path === "/auth/forgot-password") {
      const { email, organisationCode } = req.body ?? {};
      if (typeof email !== "string" || (organisationCode !== undefined && typeof organisationCode !== "string")) {
        next(); return;
      }
      const owner = await resolveAccountOrganisation(email.toLowerCase().trim(), organisationCode);
      if (owner) { withOrganisationContext(owner, next); return; }
    } else if (req.path === "/auth/reset-password" && typeof req.body?.token === "string") {
      // The unguessable, single-use token is the capability here; the reset
      // transaction still validates its exact account, company and expiry.
      const [record] = await systemDb.select({ organisationId: passwordResetTokensTable.organisationId })
        .from(passwordResetTokensTable).where(eq(passwordResetTokensTable.token, req.body.token)).limit(1);
      if (record?.organisationId) { withOrganisationContext(record.organisationId, next); return; }
    }
    next();
  } catch (error) { next(error); }
});
router.use((req, res, next) => {
  if (!req.path.startsWith("/auth/") || publicAuthPaths.has(req.path)) { next(); return; }
  return organisationContext(req, res, next);
});
router.use(emergencyHeadingPreferencesRouter);

router.post("/auth/login", async (req, res): Promise<void> => {
  const { email, password, organisationCode } = req.body ?? {};

  if (typeof email !== "string" || typeof password !== "string" || !email.trim() || !password ||
      (organisationCode !== undefined && typeof organisationCode !== "string")) {
    res.status(400).json({ error: "Email and password are required." });
    return;
  }

  const normalised = String(email).toLowerCase().trim();

  try {
    const orgId = await resolveAccountOrganisation(normalised, organisationCode);
    if (!orgId) {
      res.status(401).json({ error: "Invalid credentials or organisation code. If you have accounts with more than one company, enter your organisation code." });
      return;
    }
    // --- Check staff ---
    const [staff] = await db
      .select()
      .from(staffTable)
      .where(and(eq(staffTable.email, normalised), eq(staffTable.organisationId, orgId)));

    if (staff) {
      if (!staff.passwordHash) {
        res.status(401).json({ error: "No password has been set for this account. Please contact your administrator." });
        return;
      }
      if (staff.blockedAt) {
        res.status(401).json({ error: "Your account has been blocked. Please contact your administrator." });
        return;
      }
      const valid = await bcrypt.compare(String(password), staff.passwordHash);
      if (!valid) {
        res.status(401).json({ error: "Invalid email or password." });
        return;
      }
      req.session.user = {
        id: staff.id,
        type: "staff",
        role: staff.role,
        email: staff.email,
        name: `${staff.firstName} ${staff.lastName}`,
        siteId: staff.siteId,
      };
      await new Promise<void>((resolve, reject) =>
        req.session.save((err) => (err ? reject(err) : resolve()))
      );
      // Update last login timestamp
      await db.update(staffTable).set({ lastLoginAt: new Date() as any }).where(eq(staffTable.id, staff.id));
      res.json({ user: { ...req.session.user, organisationId: orgId } });
      return;
    }

    // --- Check guardian ---
    const [guardian] = await db
      .select()
      .from(parentAccountsTable)
      .where(and(eq(parentAccountsTable.guardianEmail, normalised), eq(parentAccountsTable.organisationId, orgId)));

    if (guardian) {
      if (!guardian.passwordHash) {
        res.status(401).json({ error: "No password has been set for this account. Please contact your administrator." });
        return;
      }
      if (guardian.blockedAt) {
        res.status(401).json({ error: "Your account has been blocked. Please contact your administrator." });
        return;
      }
      const valid = await bcrypt.compare(String(password), guardian.passwordHash);
      if (!valid) {
        res.status(401).json({ error: "Invalid email or password." });
        return;
      }

      const [firstChild] = await db
        .select({
          guardianName: childrenTable.guardianName,
          guardian2Name: childrenTable.guardian2Name,
          guardian2Email: childrenTable.guardian2Email,
        })
        .from(childrenTable)
        .where(guardianChildren(guardian.organisationId!, guardian.guardianEmail))
        .limit(1);

      let displayName = guardian.guardianEmail;
      if (firstChild) {
        const isSecondGuardian = firstChild.guardian2Email?.toLowerCase() === guardian.guardianEmail.toLowerCase();
        displayName = isSecondGuardian
          ? (firstChild.guardian2Name ?? firstChild.guardianName ?? guardian.guardianEmail)
          : (firstChild.guardianName ?? guardian.guardianEmail);
      }

      req.session.user = {
        id: guardian.id,
        type: "guardian",
        role: "guardian",
        email: guardian.guardianEmail,
        name: displayName,
      };
      await new Promise<void>((resolve, reject) =>
        req.session.save((err) => (err ? reject(err) : resolve()))
      );

      // Update last login and append to login log
      await db
        .update(parentAccountsTable)
        .set({ lastLoginAt: new Date() as any })
        .where(eq(parentAccountsTable.id, guardian.id));
      await db.insert(guardianLoginLogsTable).values({
        guardianEmail: guardian.guardianEmail, organisationId: guardian.organisationId,
      });

      res.json({ user: { ...req.session.user, organisationId: orgId } });
      return;
    }

    const [school] = await db
      .select({ id: schoolAccountsTable.id, siteId: schoolAccountsTable.siteId, username: schoolAccountsTable.username, passwordHash: schoolAccountsTable.passwordHash, blockedAt: schoolAccountsTable.blockedAt })
      .from(schoolAccountsTable)
      .innerJoin(sitesTable, eq(schoolAccountsTable.siteId, sitesTable.id))
      .where(and(eq(schoolAccountsTable.username, normalised), eq(sitesTable.orgId, orgId)));
    if (school) {
      if (!school.passwordHash) { res.status(401).json({ error: "No password has been set for this school account." }); return; }
      if (school.blockedAt) { res.status(401).json({ error: "This school account has been blocked." }); return; }
      const valid = await bcrypt.compare(String(password), school.passwordHash);
      if (!valid) { res.status(401).json({ error: "Invalid username or password." }); return; }
      const [site] = await db.select({ name: sitesTable.name }).from(sitesTable).where(eq(sitesTable.id, school.siteId));
      req.session.user = { id: school.id, type: "school", role: "school", email: school.username, name: site?.name ?? "School", siteId: school.siteId };
      await new Promise<void>((resolve, reject) => req.session.save((err) => (err ? reject(err) : resolve())));
      await db.update(schoolAccountsTable).set({ lastLoginAt: new Date() as any }).where(eq(schoolAccountsTable.id, school.id));
      res.json({ user: { ...req.session.user, organisationId: orgId } });
      return;
    }

    res.status(401).json({ error: "Invalid email or password." });
  } catch (err) {
    req.log.error({ err, email: normalised }, "Failed to login");
    res.status(500).json({ error: "Failed to login" });
  }
});

router.get("/auth/me", (req, res): void => {
  if (!req.session.user) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  res.json({ user: { ...req.session.user, organisationId: organisationId(res) } });
});

router.post("/auth/logout", (req, res): void => {
  req.session.destroy(() => {
    res.clearCookie("connect.sid");
    res.json({ ok: true });
  });
});

router.post("/auth/forgot-password", async (req, res): Promise<void> => {
  const { email, organisationCode } = req.body ?? {};
  if (!email || typeof email !== "string") {
    res.status(400).json({ error: "Email is required." });
    return;
  }
  const normalised = email.toLowerCase().trim();
  if (organisationCode !== undefined && typeof organisationCode !== "string") {
    res.status(400).json({ error: "Invalid organisation code." }); return;
  }

  try {
    const orgId = await resolveAccountOrganisation(normalised, organisationCode);
    if (!orgId) { res.json({ ok: true }); return; }
    // Look up user — always respond with 200 to avoid email enumeration
    let userType: "staff" | "guardian" | null = null;
    let account: { id: number; organisationId: number | null } | undefined;

    const [staff] = await db.select({ id: staffTable.id, organisationId: staffTable.organisationId })
      .from(staffTable).where(and(eq(staffTable.email, normalised), eq(staffTable.organisationId, orgId)));
    if (staff) { userType = "staff"; account = staff; }

    if (!userType) {
      const [guardian] = await db
        .select({ id: parentAccountsTable.id, organisationId: parentAccountsTable.organisationId })
        .from(parentAccountsTable)
        .where(and(eq(parentAccountsTable.guardianEmail, normalised), eq(parentAccountsTable.organisationId, orgId)));
      if (guardian) { userType = "guardian"; account = guardian; }
    }

    if (userType && account?.organisationId) {
      const token = randomBytes(32).toString("hex");
      const expiresAt = new Date(Date.now() + 4 * 60 * 60 * 1000); // 4 hours

      await db.insert(passwordResetTokensTable).values({
        token,
        organisationId: account.organisationId,
        accountId: account.id,
        email: normalised,
        userType,
        expiresAt,
      });

      const query = await organisationRoutingQuery(account.organisationId);
      const resetUrl = `${getAppUrl()}/reset-password?token=${token}${query ? `&${query}` : ""}`;

      try {
        const branding = await getEmailBranding(account.organisationId);
        await sendPasswordResetEmail(normalised, resetUrl, branding);
      } catch (err) {
        req.log.error({ err, email: normalised }, "Failed to send password reset email");
      }
    }

    // Always return 200 — don't reveal whether the account exists
    res.json({ ok: true });
  } catch (err) {
    req.log.error({ err, email: normalised }, "Failed to process forgot-password request");
    res.status(500).json({ error: "Failed to process forgot-password request" });
  }
});

router.post("/auth/reset-password", async (req, res): Promise<void> => {
  const { token, password } = req.body ?? {};

  if (!token || typeof token !== "string") {
    res.status(400).json({ error: "Reset token is required." });
    return;
  }
  if (!password || typeof password !== "string" || password.length < 8) {
    res.status(400).json({ error: "Password must be at least 8 characters." });
    return;
  }
  const [owner] = await systemDb.select({ id: passwordResetTokensTable.organisationId }).from(passwordResetTokensTable)
    .where(eq(passwordResetTokensTable.token, token)).limit(1);
  if (!owner?.id) { res.status(400).json({ error: "This reset link is invalid or has expired." }); return; }

  try {
    const now = new Date();
    const hash = await bcrypt.hash(password, 12);

    // Atomically consume the token and update the password in a single transaction.
    // The conditional update (usedAt IS NULL AND expiresAt > now) acts as the validation
    // check, eliminating any race between token lookup and consumption.
    const consumed = await db.transaction(async (tx) => {
      const [claimed] = await tx
        .update(passwordResetTokensTable)
        .set({ usedAt: now })
        .where(
          and(
            eq(passwordResetTokensTable.token, token),
            isNull(passwordResetTokensTable.usedAt),
            gt(passwordResetTokensTable.expiresAt, now)
          )
        )
        .returning();

      if (!claimed) return null;
      // Legacy email-only tokens are deliberately not allowed to change a
      // password: an email is not an account identity across companies.
      if (!claimed.organisationId || !claimed.accountId) return null;

      if (claimed.userType === "staff") {
        const [updated] = await tx.update(staffTable).set({ passwordHash: hash }).where(and(
          eq(staffTable.id, claimed.accountId), eq(staffTable.organisationId, claimed.organisationId),
          eq(staffTable.email, claimed.email),
        )).returning({ id: staffTable.id });
        if (!updated) return null;
      } else if (claimed.userType === "guardian") {
        const [updated] = await tx.update(parentAccountsTable).set({ passwordHash: hash }).where(and(
          eq(parentAccountsTable.id, claimed.accountId), eq(parentAccountsTable.organisationId, claimed.organisationId),
          eq(parentAccountsTable.guardianEmail, claimed.email),
        )).returning({ id: parentAccountsTable.id });
        if (!updated) return null;
      } else return null;

      return claimed;
    });

    if (!consumed) {
      res.status(400).json({ error: "This reset link is invalid or has expired. Please request a new one." });
      return;
    }

    res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "Failed to reset password");
    res.status(500).json({ error: "Failed to reset password" });
  }
});

router.get("/auth/my-children", async (req, res): Promise<void> => {
  if (!req.session.user || req.session.user.type !== "guardian") {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  const email = req.session.user.email;
  try {
    const children = await db
      .select()
      .from(childrenTable)
      .where(guardianChildren(organisationId(res), email))
      .orderBy(asc(childrenTable.lastName), asc(childrenTable.firstName));
    res.json(children);
  } catch (err) {
    req.log.error({ err, email }, "Failed to fetch my-children");
    res.status(500).json({ error: "Failed to fetch my-children" });
  }
});

router.get("/auth/my-posts", async (req, res): Promise<void> => {
  if (!req.session.user || req.session.user.type !== "guardian") {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  const email = req.session.user.email;
  try {
    const children = await db
      .select({ id: childrenTable.id, firstName: childrenTable.firstName, lastName: childrenTable.lastName })
      .from(childrenTable)
      .where(guardianChildren(organisationId(res), email));

    if (children.length === 0) {
      res.json([]);
      return;
    }

    const childIds = children.map((c) => c.id);

    const [posts, siteList] = await Promise.all([
      db.select().from(postsTable)
        .where(
          and(
            isNotNull(postsTable.publishedAt),
            eq(postsTable.organisationId, organisationId(res)),
            sql`${postsTable.childIds} && ARRAY[${sql.join(childIds.map((id) => sql`${id}`), sql`, `)}]::integer[]`,
          )
        )
        .orderBy(postsTable.publishedAt),
      db.select().from(sitesTable).where(eq(sitesTable.orgId, organisationId(res))),
    ]);

    const enriched = posts.map((p) => {
      const site = siteList.find((s) => s.id === p.siteId);
      const postChildNames = (p.childIds ?? []).map((cid) => {
        const c = children.find((ch) => ch.id === cid);
        return c ? `${c.firstName} ${c.lastName}` : null;
      }).filter(Boolean) as string[];
      return {
        ...p,
        childNames: postChildNames,
        staffName: null as string | null,
        siteName: site ? site.name : null,
      };
    });

    res.json(enriched);
  } catch (err) {
    req.log.error({ err, email }, "Failed to fetch my-posts");
    res.status(500).json({ error: "Failed to fetch my-posts" });
  }
});

router.get("/auth/my-plans", async (req, res): Promise<void> => {
  if (!req.session.user || req.session.user.type !== "guardian") {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  const email = req.session.user.email;
  try {
    const children = await db
      .select({ siteId: childrenTable.siteId })
      .from(childrenTable)
      .where(guardianChildren(organisationId(res), email));

    const siteIds = [...new Set(children.map((c) => c.siteId).filter((id): id is number => id != null))];

    if (siteIds.length === 0) {
      res.json([]);
      return;
    }

    const [plans, sites] = await Promise.all([
      db.select()
        .from(planningExperiencesTable)
        .where(
          and(
            inArray(planningExperiencesTable.siteId, siteIds),
            sql`${planningExperiencesTable.stage} = 'published'`,
            isNotNull(planningExperiencesTable.weeklyPlanData),
          )
        )
        .orderBy(planningExperiencesTable.startDate),
      db.select().from(sitesTable).where(eq(sitesTable.orgId, organisationId(res))),
    ]);

    const enriched = plans.map((p) => ({
      id: p.id,
      title: p.title,
      stage: p.stage,
      startDate: p.startDate,
      createdAt: p.createdAt,
      siteId: p.siteId,
      siteName: sites.find((s) => s.id === p.siteId)?.name ?? null,
      weeklyPlanData: p.weeklyPlanData,
      preparedBy: p.preparedBy,
    }));

    res.json(enriched);
  } catch (err) {
    req.log.error({ err, email }, "Failed to fetch my-plans");
    res.status(500).json({ error: "Failed to fetch my-plans" });
  }
});

router.put("/auth/my-children/:id/pickups", async (req, res): Promise<void> => {
  if (!req.session.user || req.session.user.type !== "guardian") {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  const childId = Number(req.params.id);
  if (isNaN(childId)) { res.status(400).json({ error: "Invalid id" }); return; }

  const email = req.session.user.email;
  try {
    const [child] = await db
      .select({ id: childrenTable.id })
      .from(childrenTable)
      .where(and(eq(childrenTable.id, childId), guardianChildren(organisationId(res), email)));
    if (!child) { res.status(404).json({ error: "Not found" }); return; }

    const pickups = req.body as Array<{ id: string; fullName: string; phone: string; relationship: string }>;
    if (!Array.isArray(pickups)) { res.status(400).json({ error: "Expected array" }); return; }

    await db.update(childrenTable).set({ approvedPickups: pickups } as any)
      .where(and(eq(childrenTable.id, childId), guardianChildren(organisationId(res), email)));
    res.json({ ok: true });
  } catch (err) {
    req.log.error({ err, childId, email }, "Failed to update pickups");
    res.status(500).json({ error: "Failed to update pickups" });
  }
});

router.post("/auth/acknowledge-comm-entry", async (req, res): Promise<void> => {
  if (!req.session.user || req.session.user.type !== "guardian") {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  const { childId, entryId } = req.body as { childId: number; entryId: string };
  if (!childId || !entryId) { res.status(400).json({ error: "childId and entryId required" }); return; }

  const email = req.session.user.email;
  try {
    const [child] = await db
      .select()
      .from(childrenTable)
      .where(and(eq(childrenTable.id, childId), guardianChildren(organisationId(res), email)));
    if (!child) { res.status(404).json({ error: "Not found" }); return; }

    const plan = child.communicationPlan as any;
    if (!plan?.communications) { res.status(400).json({ error: "No communication plan" }); return; }

    const updated = {
      ...plan,
      communications: (plan.communications as any[]).map((e: any) =>
        e.id === entryId ? { ...e, guardianAcknowledgedAt: new Date().toISOString() } : e
      ),
    };

    await db.update(childrenTable).set({ communicationPlan: updated } as any)
      .where(and(eq(childrenTable.id, childId), guardianChildren(organisationId(res), email)));
    res.json({ ok: true });
  } catch (err) {
    req.log.error({ err, childId, email }, "Failed to acknowledge comm entry");
    res.status(500).json({ error: "Failed to acknowledge comm entry" });
  }
});

// Guardian-scoped educators — staff from the guardian's children's home site(s)
router.get("/auth/my-educators", async (req, res): Promise<void> => {
  if (!req.session.user || req.session.user.type !== "guardian") {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  const email = req.session.user.email;
  try {
    const children = await db
      .select({ siteId: childrenTable.siteId })
      .from(childrenTable)
      .where(and(
        guardianChildren(organisationId(res), email),
        eq(childrenTable.status, "active"),
      ));

    const siteIds = [...new Set(children.map((c) => c.siteId).filter((id): id is number => id != null))];

    // Fetch all active staff — site-filtered for educators/coordinators, all for leaders/admins
    const allStaff = await db
      .select({
        id: staffTable.id,
        firstName: staffTable.firstName,
        lastName: staffTable.lastName,
        role: staffTable.role,
        bio: staffTable.bio,
        profilePicturePath: staffTable.profilePicturePath,
        siteId: staffTable.siteId,
      })
      .from(staffTable)
      .where(and(eq(staffTable.status, "active"), ne(staffTable.isSuperAdmin, true), eq(staffTable.organisationId, organisationId(res))))
      .orderBy(staffTable.lastName);

    // Site staff (educator + coordinator at guardian's child's site)
    const siteStaff = allStaff.filter(
      (s) =>
        (s.role === "educator" || s.role === "coordinator") &&
        s.siteId != null &&
        siteIds.includes(s.siteId),
    );

    // Educational leaders (service-wide)
    const educationalLeaders = allStaff.filter((s) => s.role === "educational_leader");

    // Approved providers / admins (service-wide)
    const approvedProviders = allStaff.filter((s) => s.role === "admin");

    res.json({ siteStaff, educationalLeaders, approvedProviders });
  } catch (err) {
    req.log.error({ err, email }, "Failed to fetch my-educators");
    res.status(500).json({ error: "Failed to fetch my-educators" });
  }
});

// Guardian-scoped notices — only notices that apply to the guardian's sites (or global ones)
router.get("/auth/my-notices", async (req, res): Promise<void> => {
  if (!req.session.user || req.session.user.type !== "guardian") {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  const email = req.session.user.email;
  try {
    const children = await db
      .select({ siteId: childrenTable.siteId })
      .from(childrenTable)
      .where(guardianChildren(organisationId(res), email));

    const siteIds = [...new Set(children.map((c) => c.siteId).filter((id): id is number => id != null))];

    // Show notices that are either:
    // - global (siteId IS NULL), or
    // - targeted at one of the guardian's child's sites
    const rows = await db
      .select()
      .from(noticesTable)
      .where(
        and(
          eq(noticesTable.audience, "guardian"),
          eq(noticesTable.organisationId, organisationId(res)),
          siteIds.length > 0
            ? or(isNull(noticesTable.siteId), inArray(noticesTable.siteId, siteIds))
            : isNull(noticesTable.siteId),
        ),
      )
      .orderBy(noticesTable.createdAt);

    res.json(rows);
  } catch (err) {
    req.log.error({ err, email }, "Failed to fetch my-notices");
    res.status(500).json({ error: "Failed to fetch my-notices" });
  }
});

router.put("/auth/change-password", async (req, res): Promise<void> => {
  if (!req.session.user) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  const { currentPassword, newPassword } = req.body ?? {};
  if (!currentPassword || !newPassword) {
    res.status(400).json({ error: "Current password and new password are required." });
    return;
  }
  if (typeof newPassword !== "string" || newPassword.length < 8) {
    res.status(400).json({ error: "New password must be at least 8 characters." });
    return;
  }

  const { type, email, id } = req.session.user;
  if (type !== "staff" && type !== "guardian") {
    res.status(403).json({ error: "Not permitted" }); return;
  }

  try {
    let currentHash: string | null = null;
    if (type === "staff") {
      const [row] = await db.select({ h: staffTable.passwordHash }).from(staffTable)
        .where(and(eq(staffTable.id, id), eq(staffTable.organisationId, organisationId(res))));
      currentHash = row?.h ?? null;
    } else {
      const [row] = await db.select({ h: parentAccountsTable.passwordHash }).from(parentAccountsTable)
        .where(and(eq(parentAccountsTable.id, id), eq(parentAccountsTable.organisationId, organisationId(res))));
      currentHash = row?.h ?? null;
    }

    if (!currentHash || !(await bcrypt.compare(currentPassword, currentHash))) {
      res.status(400).json({ error: "Current password is incorrect." });
      return;
    }

    const newHash = await bcrypt.hash(newPassword, 12);
    if (type === "staff") {
      await db.update(staffTable).set({ passwordHash: newHash })
        .where(and(eq(staffTable.id, id), eq(staffTable.organisationId, organisationId(res))));
    } else {
      await db.update(parentAccountsTable).set({ passwordHash: newHash })
        .where(and(eq(parentAccountsTable.id, id), eq(parentAccountsTable.organisationId, organisationId(res))));
    }

    res.json({ ok: true });
  } catch (err) {
    req.log.error({ err, email }, "Failed to change password");
    res.status(500).json({ error: "Failed to change password" });
  }
});

export default router;
