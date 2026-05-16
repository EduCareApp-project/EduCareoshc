import { Router, type IRouter } from "express";
import bcrypt from "bcryptjs";
import { eq, asc } from "drizzle-orm";
import { db, staffTable, parentAccountsTable, childrenTable } from "@workspace/db";

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
