import { Router } from "express";
import bcrypt from "bcrypt";
import { pool, db, postsTable, childrenTable, parentAccountsTable } from "@workspace/db";
import { and, eq, gte, isNotNull, isNull } from "drizzle-orm";
import { sendPostNotificationEmail } from "../lib/email";
import { getEmailBranding } from "../lib/emailBranding";
import { getAppUrl } from "../lib/appUrl";
import { logger } from "../lib/logger";

const router = Router();

router.post("/super-admin/login", async (req, res) => {
  const { email, password } = req.body as { email?: string; password?: string };
  const expectedEmail = process.env.SUPER_ADMIN_EMAIL;
  const expectedHash = process.env.SUPER_ADMIN_PASSWORD_HASH;
  if (!expectedEmail || !expectedHash) { res.status(503).json({ error: "Super admin not configured" }); return; }
  if (!email || !password) { res.status(400).json({ error: "Email and password required" }); return; }
  if (email.toLowerCase() !== expectedEmail.toLowerCase()) { res.status(401).json({ error: "Invalid credentials" }); return; }
  const valid = await bcrypt.compare(password, expectedHash);
  if (!valid) { res.status(401).json({ error: "Invalid credentials" }); return; }
  req.session.superAdmin = { email };
  res.json({ ok: true, email });
});

router.post("/super-admin/logout", (req, res) => {
  req.session.superAdmin = undefined;
  res.json({ ok: true });
});

router.get("/super-admin/session", (req, res) => {
  if (!req.session.superAdmin) { res.status(401).json({ error: "Not authenticated" }); return; }
  res.json({ email: req.session.superAdmin.email });
});

function requireSuperAdmin(req: any, res: any, next: any) {
  if (!req.session?.superAdmin) { res.status(401).json({ error: "Unauthorized" }); return; }
  next();
}

router.get("/super-admin/orgs", requireSuperAdmin, async (req, res) => {
  const client = await pool.connect();
  try {
    const result = await client.query("SELECT * FROM super_admin_orgs ORDER BY created_at DESC");
    res.json(result.rows);
  } finally { client.release(); }
});

router.post("/super-admin/orgs", requireSuperAdmin, async (req, res) => {
  const { name, domain, logo_url, contact_name, contact_email, status, notes } = req.body as Record<string, string>;
  if (!name) { res.status(400).json({ error: "Name is required" }); return; }
  const client = await pool.connect();
  try {
    const result = await client.query(
      `INSERT INTO super_admin_orgs (name, domain, logo_url, contact_name, contact_email, status, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [name, domain || null, logo_url || null, contact_name || null, contact_email || null, status || "active", notes || null]
    );
    res.status(201).json(result.rows[0]);
  } finally { client.release(); }
});

router.patch("/super-admin/orgs/:id", requireSuperAdmin, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const { name, domain, logo_url, contact_name, contact_email, status, notes } = req.body as Record<string, string | undefined>;
  const client = await pool.connect();
  try {
    const result = await client.query(
      `UPDATE super_admin_orgs SET
        name=COALESCE($1,name), domain=$2, logo_url=$3, contact_name=$4,
        contact_email=$5, status=COALESCE($6,status), notes=$7, updated_at=NOW()
       WHERE id=$8 RETURNING *`,
      [name ?? null, domain ?? null, logo_url ?? null, contact_name ?? null, contact_email ?? null, status ?? null, notes ?? null, id]
    );
    if (result.rows.length === 0) { res.status(404).json({ error: "Not found" }); return; }
    res.json(result.rows[0]);
  } finally { client.release(); }
});

router.delete("/super-admin/orgs/:id", requireSuperAdmin, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const client = await pool.connect();
  try {
    await client.query("DELETE FROM super_admin_orgs WHERE id=$1", [id]);
    res.json({ ok: true });
  } finally { client.release(); }
});

router.post("/super-admin/resend-post-notifications", requireSuperAdmin, async (req, res) => {
  const hours = Math.min(Math.max(parseInt((req.query.hours as string) ?? "48", 10) || 48, 1), 168);
  const since = new Date(Date.now() - hours * 60 * 60 * 1000);

  const posts = await db
    .select()
    .from(postsTable)
    .where(gte(postsTable.publishedAt, since));

  if (posts.length === 0) {
    res.json({ posts: 0, emails: 0, summary: [], errors: [] });
    return;
  }

  const appUrl = getAppUrl();
  const branding = await getEmailBranding();
  const portalUrl = `${appUrl}/notices`;

  const summary: { postId: number; title: string; sent: number }[] = [];
  const allErrors: string[] = [];

  for (const post of posts) {
    const childJoinConditions = [
      eq(childrenTable.guardianEmail, parentAccountsTable.guardianEmail),
      eq(childrenTable.status, "active"),
      ...(post.siteId ? [eq(childrenTable.siteId, post.siteId)] : []),
    ];

    const guardians = await db
      .selectDistinct({ email: parentAccountsTable.guardianEmail })
      .from(parentAccountsTable)
      .innerJoin(childrenTable, and(...childJoinConditions))
      .where(
        and(
          isNotNull(parentAccountsTable.passwordHash),
          isNull(parentAccountsTable.blockedAt),
        ),
      );

    const recipients = guardians.map((g) => g.email).filter(Boolean) as string[];

    const plainText = ((post.description ?? (post as any).learning ?? "") as string)
      .replace(/<[^>]*>/g, "")
      .trim();
    const lines = plainText.split(/\n+/).map((l: string) => l.trim()).filter(Boolean);
    const excerpt = lines.length > 0
      ? lines.slice(0, 3).join("\n") || null
      : (plainText.slice(0, 250) || null);

    const images: string[] = Array.isArray((post as any).images) ? (post as any).images : [];
    const firstImage = images[0] ?? null;
    const firstImageUrl = firstImage
      ? `${appUrl}/api/storage/objects/${firstImage.replace(/^\/objects\//, "")}`
      : null;

    try {
      await sendPostNotificationEmail(
        recipients,
        { postTitle: post.title, excerpt, portalUrl, firstImageUrl },
        branding,
      );
      summary.push({ postId: post.id, title: post.title, sent: recipients.length });
    } catch (err) {
      logger.error({ err, postId: post.id }, "Resend post notification failed");
      allErrors.push(`post:${post.id}`);
    }
  }

  res.json({
    posts: posts.length,
    emails: summary.reduce((n, s) => n + s.sent, 0),
    summary,
    errors: allErrors,
  });
});

export default router;
