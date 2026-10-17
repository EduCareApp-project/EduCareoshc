import { Router, type IRouter } from "express";
import { eq, sql, or, desc } from "drizzle-orm";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import { db, childrenTable, parentAccountsTable, guardianLoginLogsTable } from "@workspace/db";
import {
  ListGuardiansResponse,
  GetGuardianResponse,
  UpdateGuardianBody,
  ResetGuardianPasswordResponse,
} from "@workspace/api-zod";
import { sendWelcomeEmail } from "../lib/email";
import { getEmailBranding } from "../lib/emailBranding";
import { getAppUrl } from "../lib/appUrl";

const router: IRouter = Router();

async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

function generatePassword(): string {
  const chars = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789";
  let result = "";
  const bytes = crypto.randomBytes(10);
  for (const b of bytes) result += chars[b % chars.length];
  return result;
}

async function buildGuardianList() {
  const children = await db.select().from(childrenTable).orderBy(childrenTable.guardianName);
  const accounts = await db.select().from(parentAccountsTable);
  const accountMap = new Map(accounts.map((a) => [a.guardianEmail, a]));

  const grouped = new Map<string, {
    guardianEmail: string;
    guardianName: string;
    guardianPhone: string;
    childIds: number[];
    childNames: string[];
    siteIds: number[];
  }>();

  for (const c of children) {
    // Primary guardian
    const key = c.guardianEmail;
    if (!grouped.has(key)) {
      grouped.set(key, {
        guardianEmail: c.guardianEmail,
        guardianName: c.guardianName,
        guardianPhone: c.guardianPhone,
        childIds: [],
        childNames: [],
        siteIds: [],
      });
    }
    const g = grouped.get(key)!;
    g.childIds.push(c.id);
    g.childNames.push(`${c.firstName} ${c.lastName}`);
    if (c.siteId != null && !g.siteIds.includes(c.siteId)) g.siteIds.push(c.siteId);

    // Second guardian (if set)
    if (c.guardian2Email) {
      const key2 = c.guardian2Email;
      if (!grouped.has(key2)) {
        grouped.set(key2, {
          guardianEmail: c.guardian2Email,
          guardianName: c.guardian2Name ?? c.guardian2Email,
          guardianPhone: c.guardian2Phone ?? "",
          childIds: [],
          childNames: [],
          siteIds: [],
        });
      }
      const g2 = grouped.get(key2)!;
      if (!g2.childIds.includes(c.id)) {
        g2.childIds.push(c.id);
        g2.childNames.push(`${c.firstName} ${c.lastName}`);
      }
      if (c.siteId != null && !g2.siteIds.includes(c.siteId)) g2.siteIds.push(c.siteId);
    }
  }

  return Array.from(grouped.values()).map((g) => {
    const acct = accountMap.get(g.guardianEmail);
    return {
      ...g,
      username: acct?.username ?? null,
      hasPassword: !!acct?.passwordHash,
    };
  });
}

router.get("/guardians", async (req, res): Promise<void> => {
  try {
    const list = await buildGuardianList();
    res.json(ListGuardiansResponse.parse(list));
  } catch (err) {
    req.log.error({ err }, "Failed to list guardians");
    res.status(500).json({ error: "Failed to list guardians" });
  }
});

router.get("/guardians/:email", async (req, res): Promise<void> => {
  const email = decodeURIComponent(req.params.email);
  try {
    const list = await buildGuardianList();
    const guardian = list.find((g) => g.guardianEmail === email);
    if (!guardian) {
      res.status(404).json({ error: "Guardian not found" });
      return;
    }
    res.json(GetGuardianResponse.parse(guardian));
  } catch (err) {
    req.log.error({ err, email }, "Failed to get guardian");
    res.status(500).json({ error: "Failed to get guardian" });
  }
});

router.patch("/guardians/:email", async (req, res): Promise<void> => {
  const email = decodeURIComponent(req.params.email);
  const parsed = UpdateGuardianBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  try {
    await db
      .insert(parentAccountsTable)
      .values({ guardianEmail: email, username: parsed.data.username, organisationId: res.locals.organisationId })
      .onConflictDoUpdate({
        target: parentAccountsTable.guardianEmail,
        set: { username: parsed.data.username },
      });

    const list = await buildGuardianList();
    const guardian = list.find((g) => g.guardianEmail === email);
    res.json(GetGuardianResponse.parse(guardian));
  } catch (err) {
    req.log.error({ err, email }, "Failed to update guardian");
    res.status(500).json({ error: "Failed to update guardian" });
  }
});

router.post("/guardians/:email/send-welcome-email", async (req, res): Promise<void> => {
  const email = decodeURIComponent(req.params.email);

  try {
    const [existing] = await db
      .select()
      .from(childrenTable)
      .where(
        or(
          eq(childrenTable.guardianEmail, email),
          eq(childrenTable.guardian2Email, email),
        )
      );

    if (!existing) {
      res.status(404).json({ error: "Guardian not found" });
      return;
    }

    const guardianName =
      existing.guardianEmail === email
        ? existing.guardianName
        : (existing.guardian2Name ?? email);

    const branding = await getEmailBranding();
    await sendWelcomeEmail(email, guardianName, getAppUrl(), branding);

    res.json({ ok: true });
  } catch (err) {
    req.log.error({ err, email }, "Failed to send welcome email");
    res.status(500).json({ error: "Failed to send welcome email" });
  }
});

router.post("/guardians/:email/reset-password", async (req, res): Promise<void> => {
  const email = decodeURIComponent(req.params.email);

  try {
    const [existing] = await db
      .select()
      .from(childrenTable)
      .where(
        or(
          eq(childrenTable.guardianEmail, email),
          eq(childrenTable.guardian2Email, email),
        )
      );

    if (!existing) {
      res.status(404).json({ error: "Guardian not found" });
      return;
    }

    const supplied = (req.body as { newPassword?: string })?.newPassword;
    const newPassword = supplied && supplied.length >= 6 ? supplied : generatePassword();
    const hash = await hashPassword(newPassword);

    await db
      .insert(parentAccountsTable)
      .values({ guardianEmail: email, passwordHash: hash, organisationId: res.locals.organisationId })
      .onConflictDoUpdate({
        target: parentAccountsTable.guardianEmail,
        set: { passwordHash: hash },
      });

    res.json(ResetGuardianPasswordResponse.parse({ newPassword }));
  } catch (err) {
    req.log.error({ err, email }, "Failed to reset guardian password");
    res.status(500).json({ error: "Failed to reset guardian password" });
  }
});

// ── GET /guardians/:email/login-logs ─────────────────────────────────────────
router.get("/guardians/:email/login-logs", async (req, res): Promise<void> => {
  const email = decodeURIComponent(req.params.email).toLowerCase().trim();
  try {
    const logs = await db
      .select({ id: guardianLoginLogsTable.id, loggedInAt: guardianLoginLogsTable.loggedInAt })
      .from(guardianLoginLogsTable)
      .where(eq(guardianLoginLogsTable.guardianEmail, email))
      .orderBy(desc(guardianLoginLogsTable.loggedInAt))
      .limit(200);
    res.json(logs);
  } catch (err) {
    req.log.error({ err, email }, "Failed to get guardian login logs");
    res.status(500).json({ error: "Failed to get guardian login logs" });
  }
});

export default router;
