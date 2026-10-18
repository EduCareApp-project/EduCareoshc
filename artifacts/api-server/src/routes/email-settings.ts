import { Router, type IRouter, type Request, type Response } from "express";
import { and, eq } from "drizzle-orm";
import { organisationId } from "../lib/tenant";
import { Readable } from "stream";
import { db, emailSettingsTable } from "@workspace/db";
import { ObjectStorageService, ObjectNotFoundError } from "../lib/objectStorage";

const router: IRouter = Router();
const objectStorageService = new ObjectStorageService();

async function getOrCreateSettings(orgId: number) {
  let [row] = await db.select().from(emailSettingsTable).where(eq(emailSettingsTable.organisationId, orgId)).limit(1);
  if (!row) {
    await db.insert(emailSettingsTable).values({ organisationId: orgId }).onConflictDoNothing();
    [row] = await db.select().from(emailSettingsTable).where(eq(emailSettingsTable.organisationId, orgId)).limit(1);
  }
  return row;
}

// GET /email-settings — returns current settings (creates defaults on first access)
router.get("/email-settings", async (req: Request, res: Response): Promise<void> => {
  try {
    const row = await getOrCreateSettings(organisationId(res));
    res.json(row);
  } catch (err) {
    req.log.error({ err }, "Failed to fetch email settings");
    res.status(500).json({ error: "Failed to fetch email settings" });
  }
});

// PUT /email-settings — updates settings
router.put("/email-settings", async (req: Request, res: Response): Promise<void> => {
  const { senderName, logoPath, companyLogoPath, templates } = req.body;
  try {
    const row = await getOrCreateSettings(organisationId(res));
    await db
      .update(emailSettingsTable)
      .set({
        senderName: senderName ?? row.senderName,
        logoPath: logoPath !== undefined ? logoPath : row.logoPath,
        companyLogoPath: companyLogoPath !== undefined ? companyLogoPath : row.companyLogoPath,
        templates: templates ?? row.templates,
        updatedAt: new Date(),
      })
      .where(and(eq(emailSettingsTable.id, row.id), eq(emailSettingsTable.organisationId, organisationId(res))));
    const [updated] = await db.select().from(emailSettingsTable).where(eq(emailSettingsTable.organisationId, organisationId(res)));
    res.json(updated);
  } catch (err) {
    req.log.error({ err }, "Failed to update email settings");
    res.status(500).json({ error: "Failed to update email settings" });
  }
});

router.get("/email-settings/company-logo", async (req: Request, res: Response): Promise<void> => {
  try {
    const [row] = await db.select({ companyLogoPath: emailSettingsTable.companyLogoPath }).from(emailSettingsTable)
      .where(eq(emailSettingsTable.organisationId, organisationId(res))).limit(1);
    if (!row?.companyLogoPath) {
      res.status(404).json({ error: "No company logo configured" });
      return;
    }
    const objectFile = await objectStorageService.getObjectEntityFile(row.companyLogoPath);
    const response = await objectStorageService.downloadObject(objectFile);
    res.status(response.status);
    response.headers.forEach((value, key) => res.setHeader(key, value));
    if (response.body) {
      Readable.fromWeb(response.body as ReadableStream<Uint8Array>).pipe(res);
    } else {
      res.end();
    }
  } catch (err) {
    if (err instanceof ObjectNotFoundError) {
      res.status(404).json({ error: "Company logo not found in storage" });
    } else {
      res.status(500).json({ error: "Failed to serve company logo" });
    }
  }
});

// GET /email-settings/logo — public: serves the saved logo from object storage
// This route is registered before the auth guard so email clients can load the logo.
router.get("/email-settings/logo", async (req: Request, res: Response): Promise<void> => {
  try {
    const orgId = req.session?.user ? organisationId(res) : Number(req.query.organisationId ?? res.locals.publicOrganisationId);
    if (req.session?.user && req.query.organisationId !== undefined && Number(req.query.organisationId) !== orgId) {
      res.status(404).json({ error: "Logo not found" }); return;
    }
    if (!Number.isSafeInteger(orgId) || orgId <= 0) {
      res.status(404).json({ error: "Logo not found" }); return;
    }
    const [row] = await db.select({ logoPath: emailSettingsTable.logoPath }).from(emailSettingsTable)
      .where(eq(emailSettingsTable.organisationId, orgId)).limit(1);
    if (!row?.logoPath) {
      res.status(404).json({ error: "No logo configured" });
      return;
    }
    const objectFile = await objectStorageService.getObjectEntityFile(row.logoPath);
    const response = await objectStorageService.downloadObject(objectFile);
    res.status(response.status);
    response.headers.forEach((value, key) => res.setHeader(key, value));
    if (response.body) {
      const nodeStream = Readable.fromWeb(response.body as ReadableStream<Uint8Array>);
      nodeStream.pipe(res);
    } else {
      res.end();
    }
  } catch (err) {
    if (err instanceof ObjectNotFoundError) {
      res.status(404).json({ error: "Logo not found in storage" });
    } else {
      res.status(500).json({ error: "Failed to serve logo" });
    }
  }
});

export default router;
