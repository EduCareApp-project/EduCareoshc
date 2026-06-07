import { Router } from "express";
import bcrypt from "bcrypt";
import { pool } from "@workspace/db";

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

export default router;
