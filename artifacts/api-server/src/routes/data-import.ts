import { Router, type IRouter } from "express";
import { db, childrenTable, staffTable, parentAccountsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";

const router: IRouter = Router();

const ADMIN_ROLES = new Set(["admin", "educational_leader"]);

function requireAdmin(req: any, res: any): boolean {
  const user = req.session?.user;
  if (!user || user.type !== "staff" || !ADMIN_ROLES.has(user.role)) {
    res.status(403).json({ error: "Admin access required for data import." });
    return false;
  }
  return true;
}

function normalizeAgeGroup(raw: string): string | null {
  const v = raw.trim().toLowerCase().replace(/[\s_-]+/g, "_");
  if (["infant", "baby", "babies"].includes(v)) return "infant";
  if (["toddler", "toddlers"].includes(v)) return "toddler";
  if (["preschool", "pre_school", "pre_k", "kindergarten", "kindy"].includes(v)) return "preschool";
  if (["school_age", "school", "oshc", "oosh", "osc", "primary", "primary_school"].includes(v)) return "school_age";
  return null;
}

function parseDate(raw: string): string | null {
  if (!raw?.trim()) return null;
  const s = raw.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const auMatch = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (auMatch) {
    const [, d, m, y] = auMatch;
    return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  return null;
}

type ImportResult = {
  inserted: number;
  skipped: number;
  errors: Array<{ row: number; message: string; data?: string }>;
};

// ── POST /import/children ─────────────────────────────────────────────────────
router.post("/import/children", async (req, res): Promise<void> => {
  if (!requireAdmin(req, res)) return;

  const { siteId, rows } = req.body as {
    siteId: number;
    rows: Array<Record<string, string>>;
  };

  if (!siteId || !Array.isArray(rows)) {
    res.status(400).json({ error: "siteId and rows are required." });
    return;
  }

  const result: ImportResult = { inserted: 0, skipped: 0, errors: [] };

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowNum = i + 1;

    const firstName = row.firstName?.trim() || row.first_name?.trim();
    const lastName = row.lastName?.trim() || row.last_name?.trim();
    const dobRaw = row.dateOfBirth?.trim() || row.date_of_birth?.trim() || row.dob?.trim();
    const enrollRaw = row.enrollmentDate?.trim() || row.enrollment_date?.trim() || row.enrolmentDate?.trim() || row.enrolment_date?.trim();
    const ageGroupRaw = row.ageGroup?.trim() || row.age_group?.trim() || row.agegroup?.trim();
    const guardianName = row.guardianName?.trim() || row.guardian_name?.trim() || row.parentName?.trim() || row.parent_name?.trim();
    const guardianEmail = (row.guardianEmail?.trim() || row.guardian_email?.trim() || row.parentEmail?.trim() || row.parent_email?.trim())?.toLowerCase();
    const guardianPhone = row.guardianPhone?.trim() || row.guardian_phone?.trim() || row.parentPhone?.trim() || row.parent_phone?.trim();
    const medicalNotes = row.medicalNotes?.trim() || row.medical_notes?.trim() || undefined;
    const statusRaw = (row.status?.trim() || "active").toLowerCase();
    const status = ["active", "inactive", "waitlisted"].includes(statusRaw) ? statusRaw : "active";

    const errors: string[] = [];
    if (!firstName) errors.push("firstName is required");
    if (!lastName) errors.push("lastName is required");

    const dateOfBirth = parseDate(dobRaw ?? "");
    if (!dateOfBirth) errors.push("dateOfBirth is required (YYYY-MM-DD or DD/MM/YYYY)");

    const enrollmentDate = parseDate(enrollRaw ?? "");
    if (!enrollmentDate) errors.push("enrollmentDate is required (YYYY-MM-DD or DD/MM/YYYY)");

    const ageGroup = normalizeAgeGroup(ageGroupRaw ?? "");
    if (!ageGroup) errors.push(`ageGroup "${ageGroupRaw}" is not recognised — use: infant, toddler, preschool, school_age, oshc`);

    if (!guardianName) errors.push("guardianName is required");
    if (!guardianEmail) errors.push("guardianEmail is required");
    if (!guardianPhone) errors.push("guardianPhone is required");

    if (errors.length > 0) {
      result.errors.push({ row: rowNum, message: errors.join("; "), data: `${firstName ?? "?"} ${lastName ?? "?"}` });
      continue;
    }

    try {
      const existing = await db.select({ id: childrenTable.id })
        .from(childrenTable)
        .where(and(
          eq(childrenTable.firstName, firstName!),
          eq(childrenTable.lastName, lastName!),
          eq(childrenTable.guardianEmail, guardianEmail!),
        ))
        .limit(1);

      if (existing.length > 0) {
        result.skipped++;
        continue;
      }

      await db.insert(childrenTable).values({
        firstName: firstName!,
        lastName: lastName!,
        dateOfBirth: dateOfBirth! as any,
        enrollmentDate: enrollmentDate! as any,
        ageGroup: ageGroup!,
        status,
        guardianName: guardianName!,
        guardianEmail: guardianEmail!,
        guardianPhone: guardianPhone!,
        medicalNotes: medicalNotes ?? null,
        siteId,
      });
      result.inserted++;
    } catch (err: any) {
      result.errors.push({ row: rowNum, message: err?.message ?? "Database error", data: `${firstName} ${lastName}` });
    }
  }

  res.json(result);
});

// ── POST /import/staff ────────────────────────────────────────────────────────
router.post("/import/staff", async (req, res): Promise<void> => {
  if (!requireAdmin(req, res)) return;

  const { siteId, rows } = req.body as {
    siteId: number;
    rows: Array<Record<string, string>>;
  };

  if (!siteId || !Array.isArray(rows)) {
    res.status(400).json({ error: "siteId and rows are required." });
    return;
  }

  const VALID_ROLES = new Set(["educator", "coordinator", "educational_leader", "admin"]);

  const result: ImportResult = { inserted: 0, skipped: 0, errors: [] };

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowNum = i + 1;

    const firstName = row.firstName?.trim() || row.first_name?.trim();
    const lastName = row.lastName?.trim() || row.last_name?.trim();
    const email = (row.email?.trim())?.toLowerCase();
    const roleRaw = (row.role?.trim() || "educator").toLowerCase().replace(/[\s-]+/g, "_");
    const role = VALID_ROLES.has(roleRaw) ? roleRaw : "educator";
    const qualifications = row.qualifications?.trim() || row.qualification?.trim() || "To be updated";
    const phone = row.phone?.trim() || row.mobile?.trim() || undefined;
    const wwccNumber = row.wwccNumber?.trim() || row.wwcc_number?.trim() || row.wwcc?.trim() || undefined;

    const errors: string[] = [];
    if (!firstName) errors.push("firstName is required");
    if (!lastName) errors.push("lastName is required");
    if (!email) errors.push("email is required");

    if (errors.length > 0) {
      result.errors.push({ row: rowNum, message: errors.join("; "), data: email ?? `row ${rowNum}` });
      continue;
    }

    try {
      const existing = await db.select({ id: staffTable.id })
        .from(staffTable)
        .where(eq(staffTable.email, email!))
        .limit(1);

      if (existing.length > 0) {
        result.skipped++;
        continue;
      }

      await db.insert(staffTable).values({
        firstName: firstName!,
        lastName: lastName!,
        email: email!,
        role,
        qualifications,
        phone: phone ?? null,
        wwccNumber: wwccNumber ?? null,
        siteId,
      });
      result.inserted++;
    } catch (err: any) {
      result.errors.push({ row: rowNum, message: err?.message ?? "Database error", data: email });
    }
  }

  res.json(result);
});

// ── POST /import/guardians ────────────────────────────────────────────────────
router.post("/import/guardians", async (req, res): Promise<void> => {
  if (!requireAdmin(req, res)) return;

  const { rows } = req.body as {
    rows: Array<Record<string, string>>;
  };

  if (!Array.isArray(rows)) {
    res.status(400).json({ error: "rows is required." });
    return;
  }

  const result: ImportResult = { inserted: 0, skipped: 0, errors: [] };

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowNum = i + 1;

    const guardianEmail = (row.guardianEmail?.trim() || row.guardian_email?.trim() || row.email?.trim())?.toLowerCase();
    const username = row.username?.trim() || undefined;

    if (!guardianEmail) {
      result.errors.push({ row: rowNum, message: "guardianEmail is required" });
      continue;
    }

    try {
      const existing = await db.select({ id: parentAccountsTable.id })
        .from(parentAccountsTable)
        .where(eq(parentAccountsTable.guardianEmail, guardianEmail))
        .limit(1);

      if (existing.length > 0) {
        result.skipped++;
        continue;
      }

      await db.insert(parentAccountsTable).values({
        guardianEmail,
        username: username ?? null,
      });
      result.inserted++;
    } catch (err: any) {
      result.errors.push({ row: rowNum, message: err?.message ?? "Database error", data: guardianEmail });
    }
  }

  res.json(result);
});

export default router;
