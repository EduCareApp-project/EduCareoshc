import { Router, type IRouter } from "express";
import bcrypt from "bcryptjs";
import { randomBytes } from "crypto";
import { eq, asc, and, or, gt, isNull, isNotNull, inArray, sql } from "drizzle-orm";
import { db, staffTable, parentAccountsTable, childrenTable, passwordResetTokensTable, postsTable, sitesTable, planningExperiencesTable, noticesTable } from "@workspace/db";
import { sendPasswordResetEmail } from "../lib/email";
import { getEmailBranding } from "../lib/emailBranding";
import { getAppUrl } from "../lib/appUrl";

const router: IRouter = Router();

router.post("/auth/login", async (req, res): Promise<void> => {
  const { email, password } = req.body ?? {};

  if (!email || !password) {
    res.status(400).json({ error: "Email and password are required." });
    return;
  }

  const normalised = String(email).toLowerCase().trim();

  // --- Check staff ---
  const [staff] = await db
    .select()
    .from(staffTable)
    .where(eq(staffTable.email, normalised));

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
    res.json({ user: req.session.user });
    return;
  }

  // --- Check guardian ---
  const [guardian] = await db
    .select()
    .from(parentAccountsTable)
    .where(eq(parentAccountsTable.guardianEmail, normalised));

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
      .where(
        or(
          eq(childrenTable.guardianEmail, guardian.guardianEmail),
          eq(childrenTable.guardian2Email, guardian.guardianEmail),
        )
      )
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

    // Update last login
    await db
      .update(parentAccountsTable)
      .set({ lastLoginAt: new Date() as any })
      .where(eq(parentAccountsTable.id, guardian.id));

    res.json({ user: req.session.user });
    return;
  }

  res.status(401).json({ error: "Invalid email or password." });
});

router.get("/auth/me", (req, res): void => {
  if (!req.session.user) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  res.json({ user: req.session.user });
});

router.post("/auth/logout", (req, res): void => {
  req.session.destroy(() => {
    res.clearCookie("connect.sid");
    res.json({ ok: true });
  });
});

router.post("/auth/forgot-password", async (req, res): Promise<void> => {
  const { email } = req.body ?? {};
  if (!email || typeof email !== "string") {
    res.status(400).json({ error: "Email is required." });
    return;
  }
  const normalised = email.toLowerCase().trim();

  // Look up user — always respond with 200 to avoid email enumeration
  let userType: "staff" | "guardian" | null = null;

  const [staff] = await db.select({ id: staffTable.id }).from(staffTable).where(eq(staffTable.email, normalised));
  if (staff) userType = "staff";

  if (!userType) {
    const [guardian] = await db
      .select({ id: parentAccountsTable.id })
      .from(parentAccountsTable)
      .where(eq(parentAccountsTable.guardianEmail, normalised));
    if (guardian) userType = "guardian";
  }

  if (userType) {
    const token = randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 4 * 60 * 60 * 1000); // 4 hours

    await db.insert(passwordResetTokensTable).values({
      token,
      email: normalised,
      userType,
      expiresAt,
    });

    const resetUrl = `${getAppUrl()}/reset-password?token=${token}`;

    try {
      const branding = await getEmailBranding();
      await sendPasswordResetEmail(normalised, resetUrl, branding);
    } catch (err) {
      req.log.error({ err, email: normalised }, "Failed to send password reset email");
    }
  }

  // Always return 200 — don't reveal whether the account exists
  res.json({ ok: true });
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

    if (claimed.userType === "staff") {
      await tx.update(staffTable).set({ passwordHash: hash }).where(eq(staffTable.email, claimed.email));
    } else {
      await tx.update(parentAccountsTable).set({ passwordHash: hash }).where(eq(parentAccountsTable.guardianEmail, claimed.email));
    }

    return claimed;
  });

  if (!consumed) {
    res.status(400).json({ error: "This reset link is invalid or has expired. Please request a new one." });
    return;
  }

  res.json({ ok: true });
});

router.get("/auth/my-children", async (req, res): Promise<void> => {
  if (!req.session.user || req.session.user.type !== "guardian") {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  const email = req.session.user.email;
  const children = await db
    .select()
    .from(childrenTable)
    .where(or(eq(childrenTable.guardianEmail, email), eq(childrenTable.guardian2Email, email)))
    .orderBy(asc(childrenTable.lastName), asc(childrenTable.firstName));
  res.json(children);
});

router.get("/auth/my-posts", async (req, res): Promise<void> => {
  if (!req.session.user || req.session.user.type !== "guardian") {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  const email = req.session.user.email;
  const children = await db
    .select({ id: childrenTable.id, firstName: childrenTable.firstName, lastName: childrenTable.lastName })
    .from(childrenTable)
    .where(or(eq(childrenTable.guardianEmail, email), eq(childrenTable.guardian2Email, email)));

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
          sql`${postsTable.childIds} && ARRAY[${sql.join(childIds.map((id) => sql`${id}`), sql`, `)}]::integer[]`,
        )
      )
      .orderBy(postsTable.publishedAt),
    db.select().from(sitesTable),
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
});

router.get("/auth/my-plans", async (req, res): Promise<void> => {
  if (!req.session.user || req.session.user.type !== "guardian") {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  const email = req.session.user.email;
  const children = await db
    .select({ siteId: childrenTable.siteId })
    .from(childrenTable)
    .where(or(eq(childrenTable.guardianEmail, email), eq(childrenTable.guardian2Email, email)));

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
    db.select().from(sitesTable),
  ]);

  const enriched = plans.map((p) => ({
    id: p.id,
    title: p.title,
    startDate: p.startDate,
    siteId: p.siteId,
    siteName: sites.find((s) => s.id === p.siteId)?.name ?? null,
    weeklyPlanData: p.weeklyPlanData,
    preparedBy: p.preparedBy,
  }));

  res.json(enriched);
});

router.put("/auth/my-children/:id/pickups", async (req, res): Promise<void> => {
  if (!req.session.user || req.session.user.type !== "guardian") {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  const childId = Number(req.params.id);
  if (isNaN(childId)) { res.status(400).json({ error: "Invalid id" }); return; }

  const email = req.session.user.email;
  const [child] = await db
    .select({ id: childrenTable.id })
    .from(childrenTable)
    .where(and(eq(childrenTable.id, childId), or(eq(childrenTable.guardianEmail, email), eq(childrenTable.guardian2Email, email))));
  if (!child) { res.status(404).json({ error: "Not found" }); return; }

  const pickups = req.body as Array<{ id: string; fullName: string; phone: string; relationship: string }>;
  if (!Array.isArray(pickups)) { res.status(400).json({ error: "Expected array" }); return; }

  await db.update(childrenTable).set({ approvedPickups: pickups } as any).where(eq(childrenTable.id, childId));
  res.json({ ok: true });
});

router.post("/auth/acknowledge-comm-entry", async (req, res): Promise<void> => {
  if (!req.session.user || req.session.user.type !== "guardian") {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  const { childId, entryId } = req.body as { childId: number; entryId: string };
  if (!childId || !entryId) { res.status(400).json({ error: "childId and entryId required" }); return; }

  const email = req.session.user.email;
  const [child] = await db
    .select()
    .from(childrenTable)
    .where(and(eq(childrenTable.id, childId), or(eq(childrenTable.guardianEmail, email), eq(childrenTable.guardian2Email, email))));
  if (!child) { res.status(404).json({ error: "Not found" }); return; }

  const plan = child.communicationPlan as any;
  if (!plan?.communications) { res.status(400).json({ error: "No communication plan" }); return; }

  const updated = {
    ...plan,
    communications: (plan.communications as any[]).map((e: any) =>
      e.id === entryId ? { ...e, guardianAcknowledgedAt: new Date().toISOString() } : e
    ),
  };

  await db.update(childrenTable).set({ communicationPlan: updated } as any).where(eq(childrenTable.id, childId));
  res.json({ ok: true });
});

// Guardian-scoped educators — staff from the guardian's children's home site(s)
router.get("/auth/my-educators", async (req, res): Promise<void> => {
  if (!req.session.user || req.session.user.type !== "guardian") {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  const email = req.session.user.email;
  const children = await db
    .select({ siteId: childrenTable.siteId })
    .from(childrenTable)
    .where(and(
      or(eq(childrenTable.guardianEmail, email), eq(childrenTable.guardian2Email, email)),
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
    .where(eq(staffTable.status, "active"))
    .orderBy(staffTable.lastName);

  // Site staff (educator + coordinator at guardian's child's site)
  const siteStaff = allStaff.filter(
    (s) =>
      (s.role === "educator" || s.role === "coordinator") &&
      s.siteId != null &&
      (siteIds.length === 0 || siteIds.includes(s.siteId)),
  );

  // Educational leaders (service-wide)
  const educationalLeaders = allStaff.filter((s) => s.role === "educational_leader");

  // Approved providers / admins (service-wide)
  const approvedProviders = allStaff.filter((s) => s.role === "admin");

  res.json({ siteStaff, educationalLeaders, approvedProviders });
});

// Guardian-scoped notices — only notices that apply to the guardian's sites (or global ones)
router.get("/auth/my-notices", async (req, res): Promise<void> => {
  if (!req.session.user || req.session.user.type !== "guardian") {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  const email = req.session.user.email;
  const children = await db
    .select({ siteId: childrenTable.siteId })
    .from(childrenTable)
    .where(or(eq(childrenTable.guardianEmail, email), eq(childrenTable.guardian2Email, email)));

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
        siteIds.length > 0
          ? or(isNull(noticesTable.siteId), inArray(noticesTable.siteId, siteIds))
          : isNull(noticesTable.siteId),
      ),
    )
    .orderBy(noticesTable.createdAt);

  res.json(rows);
});

export default router;

