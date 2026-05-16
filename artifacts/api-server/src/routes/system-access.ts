import { Router, type IRouter } from "express";
import { eq, asc } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { db, staffTable, parentAccountsTable, childrenTable } from "@workspace/db";

const router: IRouter = Router();

router.get("/reports/system-access", async (_req, res): Promise<void> => {
  const [staffRows, guardianRows, childRows] = await Promise.all([
    db.select().from(staffTable).orderBy(asc(staffTable.lastName), asc(staffTable.firstName)),
    db.select().from(parentAccountsTable).orderBy(asc(parentAccountsTable.guardianEmail)),
    db.select({
      guardianEmail: childrenTable.guardianEmail,
      guardianName: childrenTable.guardianName,
      firstName: childrenTable.firstName,
      lastName: childrenTable.lastName,
    }).from(childrenTable),
  ]);

  const guardianMeta = new Map<string, { name: string; children: string[] }>();
  for (const child of childRows) {
    const email = (child.guardianEmail ?? "").toLowerCase();
    if (!email) continue;
    if (!guardianMeta.has(email)) {
      guardianMeta.set(email, { name: child.guardianName ?? email, children: [] });
    }
    guardianMeta.get(email)!.children.push(`${child.firstName} ${child.lastName}`);
  }

  const guardians = guardianRows.map((g) => {
    const meta = guardianMeta.get(g.guardianEmail.toLowerCase());
    return {
      id: g.id,
      guardianEmail: g.guardianEmail,
      guardianName: meta?.name ?? g.guardianEmail,
      children: meta?.children ?? [],
      isConnected: !!g.passwordHash,
      blockedAt: g.blockedAt,
      lastLoginAt: g.lastLoginAt,
      createdAt: g.createdAt,
    };
  });

  const staff = staffRows.map((s) => ({
    id: s.id,
    firstName: s.firstName,
    lastName: s.lastName,
    email: s.email,
    role: s.role,
    status: s.status,
    isConnected: !!s.passwordHash,
    blockedAt: s.blockedAt,
    lastLoginAt: null as null,
    createdAt: s.createdAt,
  }));

  res.json({ staff, guardians });
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

export default router;
