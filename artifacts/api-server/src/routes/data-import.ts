import { Router, type IRouter } from "express";
import { db, childrenTable, staffTable, parentAccountsTable, observationsTable, jottingsTable, postsTable } from "@workspace/db";
import { eq, and, ilike } from "drizzle-orm";
import { organisationId, ownsSites } from "../lib/tenant";

const router: IRouter = Router();
router.use("/import", async (req, res, next) => {
  if (!requireAdmin(req, res)) return;
  if (!(await ownsSites(organisationId(res), [req.body?.siteId]))) {
    res.status(400).json({ error: "Invalid service" }); return;
  }
  next();
});

const ADMIN_ROLES = new Set(["admin", "admin_support", "educational_leader"]);

function requireAdmin(req: any, res: any): boolean {
  const user = req.session?.user;
  if (!user || user.type !== "staff" || !ADMIN_ROLES.has(user.role)) {
    res.status(403).json({ error: "Admin access required for data import." });
    return false;
  }
  return true;
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
  guardianAccountsCreated?: number;
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

  const result: ImportResult = { inserted: 0, skipped: 0, errors: [], guardianAccountsCreated: 0 };

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowNum = i + 1;

    const firstName = row.firstName?.trim() || row.first_name?.trim();
    const lastName = row.lastName?.trim() || row.last_name?.trim();
    const dobRaw = row.dateOfBirth?.trim() || row.date_of_birth?.trim() || row.dob?.trim();
    const enrollRaw = row.enrollmentDate?.trim() || row.enrollment_date?.trim() || row.enrolmentDate?.trim() || row.enrolment_date?.trim();
    const guardianName = row.guardianName?.trim() || row.guardian_name?.trim() || row.parentName?.trim() || row.parent_name?.trim();
    const guardianEmail = (row.guardianEmail?.trim() || row.guardian_email?.trim() || row.parentEmail?.trim() || row.parent_email?.trim())?.toLowerCase();
    const guardianPhone = row.guardianPhone?.trim() || row.guardian_phone?.trim() || row.parentPhone?.trim() || row.parent_phone?.trim();
    const medicalNotes = row.medicalNotes?.trim() || row.medical_notes?.trim() || undefined;
    const username = row.username?.trim() || undefined;
    const statusRaw = (row.status?.trim() || "active").toLowerCase();
    const status = ["active", "inactive", "waitlisted"].includes(statusRaw) ? statusRaw : "active";

    const errors: string[] = [];
    if (!firstName) errors.push("firstName is required");
    if (!lastName) errors.push("lastName is required");

    const dateOfBirth = parseDate(dobRaw ?? "");
    if (!dateOfBirth) errors.push("dateOfBirth is required (YYYY-MM-DD or DD/MM/YYYY)");

    const enrollmentDate = parseDate(enrollRaw ?? "");
    if (!enrollmentDate) errors.push("enrollmentDate is required (YYYY-MM-DD or DD/MM/YYYY)");

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
          eq(childrenTable.organisationId, organisationId(res)),
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
        organisationId: res.locals.organisationId,
        firstName: firstName!,
        lastName: lastName!,
        dateOfBirth: dateOfBirth! as any,
        enrollmentDate: enrollmentDate! as any,
        status,
        guardianName: guardianName!,
        guardianEmail: guardianEmail!,
        guardianPhone: guardianPhone!,
        medicalNotes: medicalNotes ?? null,
        siteId,
      });
      result.inserted++;

      // Also create a guardian portal account if one doesn't already exist
      const existingAccount = await db.select({ id: parentAccountsTable.id })
        .from(parentAccountsTable)
        .where(and(eq(parentAccountsTable.guardianEmail, guardianEmail!), eq(parentAccountsTable.organisationId, organisationId(res))))
        .limit(1);
      if (existingAccount.length === 0) {
        await db.insert(parentAccountsTable).values({
          organisationId: res.locals.organisationId,
          guardianEmail: guardianEmail!,
          username: username ?? null,
        });
        result.guardianAccountsCreated = (result.guardianAccountsCreated ?? 0) + 1;
      }
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

  const VALID_ROLES = new Set(["educator", "coordinator", "educational_leader", "admin", "admin_support", "onboarding"]);

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
        .where(and(eq(staffTable.email, email!), eq(staffTable.organisationId, organisationId(res))))
        .limit(1);

      if (existing.length > 0) {
        result.skipped++;
        continue;
      }

      await db.insert(staffTable).values({
        organisationId: res.locals.organisationId,
        firstName: firstName!,
        lastName: lastName!,
        email: email!,
        role,
        qualifications,
        phone: phone ?? null,
        wwccNumber: wwccNumber ?? null,
        siteId: role === "admin_support" || role === "onboarding" ? null : siteId,
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
        .where(and(eq(parentAccountsTable.guardianEmail, guardianEmail), eq(parentAccountsTable.organisationId, organisationId(res))))
        .limit(1);

      if (existing.length > 0) {
        result.skipped++;
        continue;
      }

      await db.insert(parentAccountsTable).values({
        organisationId: res.locals.organisationId,
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

// ── Helpers: resolve child and staff by name/email ────────────────────────────
async function resolveChild(
  firstName: string,
  lastName: string,
  siteId: number | null,
  orgId: number,
): Promise<number | null> {
  const conditions: any[] = [
    eq(childrenTable.organisationId, orgId),
    ilike(childrenTable.firstName, firstName.trim()),
    ilike(childrenTable.lastName, lastName.trim()),
  ];
  if (siteId) conditions.push(eq(childrenTable.siteId, siteId));
  const rows = await db.select({ id: childrenTable.id })
    .from(childrenTable)
    .where(and(...conditions))
    .limit(1);
  return rows[0]?.id ?? null;
}

async function resolveStaff(emailOrName: string, orgId: number): Promise<number | null> {
  const val = emailOrName.trim();
  if (!val) return null;
  // Try email first
  if (val.includes("@")) {
    const rows = await db.select({ id: staffTable.id })
      .from(staffTable)
      .where(and(eq(staffTable.organisationId, orgId), ilike(staffTable.email, val)))
      .limit(1);
    return rows[0]?.id ?? null;
  }
  // Otherwise treat as "First Last"
  const parts = val.split(/\s+/);
  if (parts.length >= 2) {
    const rows = await db.select({ id: staffTable.id })
      .from(staffTable)
      .where(and(eq(staffTable.organisationId, orgId), ilike(staffTable.firstName, parts[0]), ilike(staffTable.lastName, parts.slice(1).join(" "))))
      .limit(1);
    return rows[0]?.id ?? null;
  }
  return null;
}

function parseOutcomeIds(raw: string): string[] {
  if (!raw?.trim()) return [];
  return raw.split(/[|,;]/).map((s) => s.trim()).filter(Boolean);
}

// ── POST /import/observations ─────────────────────────────────────────────────
router.post("/import/observations", async (req, res): Promise<void> => {
  if (!requireAdmin(req, res)) return;

  const { siteId, rows } = req.body as {
    siteId: number | null;
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

    const childFirstName = row.childFirstName?.trim() || row.child_first_name?.trim() || row.childFirst?.trim();
    const childLastName = row.childLastName?.trim() || row.child_last_name?.trim() || row.childLast?.trim();
    const staffRef = row.staffEmail?.trim() || row.staff_email?.trim() || row.staff?.trim() || row.educator?.trim();
    const description = row.description?.trim();
    const observationDateRaw = row.observationDate?.trim() || row.observation_date?.trim() || row.date?.trim();
    const outcomeIds = parseOutcomeIds(row.outcomeIds ?? row.outcome_ids ?? row.outcomes ?? "");
    const commentPlan = row.commentPlan?.trim() || row.comment_plan?.trim() || undefined;
    const actionNotes = row.actionNotes?.trim() || row.action_notes?.trim() || undefined;

    const errors: string[] = [];
    if (!childFirstName) errors.push("childFirstName is required");
    if (!childLastName) errors.push("childLastName is required");
    if (!staffRef) errors.push("staffEmail is required");
    if (!description) errors.push("description is required");

    const observationDate = parseDate(observationDateRaw ?? "");
    if (!observationDate) errors.push("observationDate is required (YYYY-MM-DD or DD/MM/YYYY)");

    if (errors.length > 0) {
      result.errors.push({ row: rowNum, message: errors.join("; "), data: `${childFirstName ?? "?"} ${childLastName ?? "?"}` });
      continue;
    }

    try {
      const childId = await resolveChild(childFirstName!, childLastName!, siteId ?? null, organisationId(res));
      if (!childId) {
        result.errors.push({ row: rowNum, message: `Child "${childFirstName} ${childLastName}" not found${siteId ? " at selected site" : ""}`, data: `${childFirstName} ${childLastName}` });
        continue;
      }

      const staffId = await resolveStaff(staffRef!, organisationId(res));
      if (!staffId) {
        result.errors.push({ row: rowNum, message: `Staff "${staffRef}" not found`, data: `${childFirstName} ${childLastName}` });
        continue;
      }

      await db.insert(observationsTable).values({
        childId,
        staffId,
        description: description!,
        observationDate: observationDate! as any,
        outcomeIds,
        commentPlan: commentPlan ?? null,
        actionNotes: actionNotes ?? null,
      });
      result.inserted++;
    } catch (err: any) {
      result.errors.push({ row: rowNum, message: err?.message ?? "Database error", data: `${childFirstName} ${childLastName}` });
    }
  }

  res.json(result);
});

// ── POST /import/jottings ─────────────────────────────────────────────────────
router.post("/import/jottings", async (req, res): Promise<void> => {
  if (!requireAdmin(req, res)) return;

  const { siteId, rows } = req.body as {
    siteId: number | null;
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

    const content = row.content?.trim() || row.note?.trim() || row.text?.trim();
    const childFirstName = row.childFirstName?.trim() || row.child_first_name?.trim();
    const childLastName = row.childLastName?.trim() || row.child_last_name?.trim();
    const staffRef = row.staffEmail?.trim() || row.staff_email?.trim() || row.staff?.trim() || row.educator?.trim();

    if (!content) {
      result.errors.push({ row: rowNum, message: "content is required" });
      continue;
    }

    try {
      let childId: number | null = null;
      if (childFirstName && childLastName) {
        childId = await resolveChild(childFirstName, childLastName, siteId ?? null, organisationId(res));
        if (!childId) {
          result.errors.push({ row: rowNum, message: `Child "${childFirstName} ${childLastName}" not found${siteId ? " at selected site" : ""}`, data: content.slice(0, 60) });
          continue;
        }
      }

      let staffId: number | null = null;
      if (staffRef) {
        staffId = await resolveStaff(staffRef, organisationId(res));
        if (!staffId) {
          result.errors.push({ row: rowNum, message: `Staff "${staffRef}" not found`, data: content.slice(0, 60) });
          continue;
        }
      }

      await db.insert(jottingsTable).values({
        content,
        childId,
        staffId,
      });
      result.inserted++;
    } catch (err: any) {
      result.errors.push({ row: rowNum, message: err?.message ?? "Database error", data: content?.slice(0, 60) });
    }
  }

  res.json(result);
});

// ── POST /import/posts ────────────────────────────────────────────────────────
router.post("/import/posts", async (req, res): Promise<void> => {
  if (!requireAdmin(req, res)) return;

  const { siteId, rows } = req.body as {
    siteId: number | null;
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

    const title = row.title?.trim();
    const childFirstName = row.childFirstName?.trim() || row.child_first_name?.trim();
    const childLastName = row.childLastName?.trim() || row.child_last_name?.trim();
    const staffRef = row.staffEmail?.trim() || row.staff_email?.trim() || row.staff?.trim();
    const dateRaw = row.date?.trim() || row.postDate?.trim() || row.post_date?.trim();
    const description = row.description?.trim() || undefined;
    const learning = row.learning?.trim() || undefined;
    const opportunities = row.opportunities?.trim() || undefined;
    const outcomeIds = parseOutcomeIds(row.outcomeIds ?? row.outcome_ids ?? row.outcomes ?? "");

    if (!title) {
      result.errors.push({ row: rowNum, message: "title is required" });
      continue;
    }

    const date = dateRaw ? parseDate(dateRaw) : null;
    if (dateRaw && !date) {
      result.errors.push({ row: rowNum, message: "date format invalid — use YYYY-MM-DD or DD/MM/YYYY", data: title });
      continue;
    }

    try {
      const childIds: number[] = [];
      if (childFirstName && childLastName) {
        const childId = await resolveChild(childFirstName, childLastName, siteId ?? null, organisationId(res));
        if (!childId) {
          result.errors.push({ row: rowNum, message: `Child "${childFirstName} ${childLastName}" not found${siteId ? " at selected site" : ""}`, data: title });
          continue;
        }
        childIds.push(childId);
      }

      let staffId: number | null = null;
      if (staffRef) {
        staffId = await resolveStaff(staffRef, organisationId(res));
        if (!staffId) {
          result.errors.push({ row: rowNum, message: `Staff "${staffRef}" not found`, data: title });
          continue;
        }
      }

      await db.insert(postsTable).values({
        title,
        siteId: siteId ?? null,
        childIds,
        staffId,
        date: date as any ?? null,
        description: description ?? null,
        learning: learning ?? null,
        opportunities: opportunities ?? null,
        outcomeIds,
      });
      result.inserted++;
    } catch (err: any) {
      result.errors.push({ row: rowNum, message: err?.message ?? "Database error", data: title });
    }
  }

  res.json(result);
});

export default router;
