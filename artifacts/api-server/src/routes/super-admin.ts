import { Router } from "express";
import bcrypt from "bcrypt";
import { pool, db, postsTable, childrenTable, parentAccountsTable, sitesTable } from "@workspace/db";
import { and, eq, gte, inArray, isNotNull, isNull } from "drizzle-orm";
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

// ONE-TIME migration: fix roll_submissions rows stored with Sunday dates instead
// of Monday due to a client-side timezone bug. Safe to call multiple times.
router.post("/super-admin/migrate-roll-week-starts", requireSuperAdmin, async (req, res) => {
  const client = await pool.connect();
  try {
    const result = await client.query(`
      UPDATE roll_submissions
      SET week_start = CASE
        WHEN week_start = '2026-06-07' THEN '2026-06-08'::date
        WHEN week_start = '2026-05-10' THEN '2026-05-11'::date
      END
      WHERE week_start IN ('2026-06-07', '2026-05-10')
      RETURNING id, week_start
    `);
    res.json({ fixed: result.rowCount, rows: result.rows });
  } catch (err) {
    req.log.error({ err }, "Failed to migrate roll week starts");
    res.status(500).json({ error: "Failed to migrate roll week starts" });
  } finally {
    client.release();
  }
});

router.get("/super-admin/orgs", requireSuperAdmin, async (req, res) => {
  const client = await pool.connect();
  try {
    const result = await client.query(`
      SELECT o.*,
        COALESCE(
          json_agg(json_build_object('id', s.id, 'name', s.name) ORDER BY s.name)
          FILTER (WHERE s.id IS NOT NULL),
          '[]'::json
        ) AS sites
      FROM super_admin_orgs o
      LEFT JOIN sites s ON s.org_id = o.id
      GROUP BY o.id
      ORDER BY o.created_at DESC
    `);
    res.json(result.rows);
  } catch (err) {
    req.log.error({ err }, "Failed to fetch super-admin orgs");
    res.status(500).json({ error: "Failed to fetch orgs" });
  } finally {
    client.release();
  }
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
  } catch (err) {
    req.log.error({ err }, "Failed to create super-admin org");
    res.status(500).json({ error: "Failed to create org" });
  } finally {
    client.release();
  }
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
  } catch (err) {
    req.log.error({ err, orgId: id }, "Failed to update super-admin org");
    res.status(500).json({ error: "Failed to update org" });
  } finally {
    client.release();
  }
});

router.delete("/super-admin/orgs/:id", requireSuperAdmin, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const client = await pool.connect();
  try {
    await client.query("DELETE FROM super_admin_orgs WHERE id=$1", [id]);
    res.json({ ok: true });
  } catch (err) {
    req.log.error({ err, orgId: id }, "Failed to delete super-admin org");
    res.status(500).json({ error: "Failed to delete org" });
  } finally {
    client.release();
  }
});

router.get("/super-admin/sites", requireSuperAdmin, async (req, res) => {
  const orgId = req.query.orgId ? parseInt(req.query.orgId as string, 10) : null;
  try {
    const sites = await db
      .select({ id: sitesTable.id, name: sitesTable.name, orgId: sitesTable.orgId })
      .from(sitesTable)
      .where(orgId ? eq(sitesTable.orgId, orgId) : undefined)
      .orderBy(sitesTable.name);
    res.json(sites);
  } catch (err) {
    req.log.error({ err }, "Failed to fetch super-admin sites");
    res.status(500).json({ error: "Failed to fetch sites" });
  }
});

/** Build post WHERE conditions filtered to an org's sites (or all sites if no orgId). */
async function orgPostConditions(since: Date, orgId: number | null) {
  const conditions: ReturnType<typeof gte>[] = [gte(postsTable.publishedAt, since)];
  if (orgId) {
    const orgSites = await db
      .select({ id: sitesTable.id })
      .from(sitesTable)
      .where(eq(sitesTable.orgId, orgId));
    const siteIds = orgSites.map((s) => s.id);
    if (siteIds.length > 0) {
      conditions.push(inArray(postsTable.siteId, siteIds) as any);
    } else {
      // Org has no sites yet — return nothing
      conditions.push(eq(postsTable.id, -1) as any);
    }
  }
  return conditions;
}

router.get("/super-admin/post-preview", requireSuperAdmin, async (req, res) => {
  const hours = Math.min(Math.max(parseInt((req.query.hours as string) ?? "96", 10) || 96, 1), 720);
  const orgId = req.query.orgId ? parseInt(req.query.orgId as string, 10) : null;
  const since = new Date(Date.now() - hours * 60 * 60 * 1000);

  try {
    const conditions = await orgPostConditions(since, orgId);

    const posts = await db
      .select({ id: postsTable.id, title: postsTable.title, publishedAt: postsTable.publishedAt, siteId: postsTable.siteId })
      .from(postsTable)
      .where(and(...conditions))
      .orderBy(postsTable.publishedAt);

    res.json(posts);
  } catch (err) {
    req.log.error({ err }, "Failed to fetch post preview");
    res.status(500).json({ error: "Failed to fetch post preview" });
  }
});

router.post("/super-admin/resend-post-notifications", requireSuperAdmin, async (req, res) => {
  const hours = Math.min(Math.max(parseInt((req.query.hours as string) ?? "96", 10) || 96, 1), 720);
  const orgId = req.query.orgId ? parseInt(req.query.orgId as string, 10) : null;
  const since = new Date(Date.now() - hours * 60 * 60 * 1000);

  try {
    const conditions = await orgPostConditions(since, orgId);

    const posts = await db
      .select()
      .from(postsTable)
      .where(and(...conditions));

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
      const taggedChildIds = Array.isArray(post.childIds) ? (post.childIds as number[]) : [];

      // Skip posts with no site or no tagged children — cannot scope recipients safely
      if (!post.siteId || taggedChildIds.length === 0) {
        logger.warn({ postId: post.id }, "Skipping resend — post has no site or no tagged children");
        continue;
      }

      const taggedChildren = await db
        .select({ guardianEmail: childrenTable.guardianEmail, guardian2Email: childrenTable.guardian2Email })
        .from(childrenTable)
        .where(and(
          inArray(childrenTable.id, taggedChildIds),
          eq(childrenTable.status, "active"),
          eq(childrenTable.siteId, post.siteId),
        ));

      const recipients = [
        ...new Set(
          taggedChildren.flatMap((c) => [c.guardianEmail, c.guardian2Email]).filter((e): e is string => !!e),
        ),
      ];

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
  } catch (err) {
    req.log.error({ err }, "Failed to resend post notifications");
    res.status(500).json({ error: "Failed to resend post notifications" });
  }
});

export default router;
