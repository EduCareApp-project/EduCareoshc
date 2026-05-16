import { Router, type IRouter } from "express";
import bcrypt from "bcryptjs";
import { randomBytes } from "crypto";
import { eq, asc, and, gt, isNull } from "drizzle-orm";
import { db, staffTable, parentAccountsTable, childrenTable, passwordResetTokensTable } from "@workspace/db";
import { sendPasswordResetEmail } from "../lib/email";
import { getEmailBranding } from "../lib/emailBranding";

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
      .select({ guardianName: childrenTable.guardianName })
      .from(childrenTable)
      .where(eq(childrenTable.guardianEmail, guardian.guardianEmail))
      .limit(1);

    req.session.user = {
      id: guardian.id,
      type: "guardian",
      role: "guardian",
      email: guardian.guardianEmail,
      name: firstChild?.guardianName ?? guardian.guardianEmail,
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

    const domains = (process.env.REPLIT_DOMAINS ?? process.env.REPLIT_DEV_DOMAIN ?? "localhost").split(",");
    const baseUrl = `https://${domains[0]}`;
    const resetUrl = `${baseUrl}/reset-password?token=${token}`;

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
  const children = await db
    .select()
    .from(childrenTable)
    .where(eq(childrenTable.guardianEmail, req.session.user.email))
    .orderBy(asc(childrenTable.lastName), asc(childrenTable.firstName));
  res.json(children);
});

export default router;
