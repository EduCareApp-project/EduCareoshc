import { Router, type IRouter } from "express";
import { eq, sql } from "drizzle-orm";
import crypto from "crypto";
import { db, childrenTable, parentAccountsTable } from "@workspace/db";
import {
  ListGuardiansResponse,
  GetGuardianResponse,
  UpdateGuardianBody,
  ResetGuardianPasswordResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
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
  }>();

  for (const c of children) {
    const key = c.guardianEmail;
    if (!grouped.has(key)) {
      grouped.set(key, {
        guardianEmail: c.guardianEmail,
        guardianName: c.guardianName,
        guardianPhone: c.guardianPhone,
        childIds: [],
        childNames: [],
      });
    }
    const g = grouped.get(key)!;
    g.childIds.push(c.id);
    g.childNames.push(`${c.firstName} ${c.lastName}`);
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

router.get("/guardians", async (_req, res): Promise<void> => {
  const list = await buildGuardianList();
  res.json(ListGuardiansResponse.parse(list));
});

router.get("/guardians/:email", async (req, res): Promise<void> => {
  const email = decodeURIComponent(req.params.email);
  const list = await buildGuardianList();
  const guardian = list.find((g) => g.guardianEmail === email);
  if (!guardian) {
    res.status(404).json({ error: "Guardian not found" });
    return;
  }
  res.json(GetGuardianResponse.parse(guardian));
});

router.patch("/guardians/:email", async (req, res): Promise<void> => {
  const email = decodeURIComponent(req.params.email);
  const parsed = UpdateGuardianBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  await db
    .insert(parentAccountsTable)
    .values({ guardianEmail: email, username: parsed.data.username })
    .onConflictDoUpdate({
      target: parentAccountsTable.guardianEmail,
      set: { username: parsed.data.username },
    });

  const list = await buildGuardianList();
  const guardian = list.find((g) => g.guardianEmail === email);
  res.json(GetGuardianResponse.parse(guardian));
});

router.post("/guardians/:email/reset-password", async (req, res): Promise<void> => {
  const email = decodeURIComponent(req.params.email);

  const [existing] = await db
    .select()
    .from(childrenTable)
    .where(eq(childrenTable.guardianEmail, email));

  if (!existing) {
    res.status(404).json({ error: "Guardian not found" });
    return;
  }

  const newPassword = generatePassword();
  const hash = hashPassword(newPassword);

  await db
    .insert(parentAccountsTable)
    .values({ guardianEmail: email, passwordHash: hash })
    .onConflictDoUpdate({
      target: parentAccountsTable.guardianEmail,
      set: { passwordHash: hash },
    });

  res.json(ResetGuardianPasswordResponse.parse({ newPassword }));
});

export default router;
