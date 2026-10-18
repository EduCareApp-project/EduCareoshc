import type { RequestHandler } from "express";
import { eq, sql } from "drizzle-orm";
import { systemDb, withOrganisationContext, sitesTable, organisationTable, fileLibraryTable, tenantFilesTable } from "@workspace/db";

/** Resolve only public resources. This never grants authenticated membership. */
export const publicOrganisationContext: RequestHandler = async (req, res, next) => {
  if (!["/qip/public", "/service-docs/public", "/email-settings/logo"].includes(req.path)
      && !req.path.startsWith("/service-docs/public/file/")
      && !req.path.startsWith("/storage/public-objects/")) { next(); return; }
  try {
    let owner: number | null | undefined;
    if (req.path.startsWith("/storage/public-objects/")) {
      const path = `/public-objects/${decodeURIComponent(req.path.slice("/storage/public-objects/".length))}`;
      const [file] = await systemDb.select({ owner: tenantFilesTable.organisationId }).from(tenantFilesTable)
        .where(eq(tenantFilesTable.objectPath, path)).limit(1);
      owner = file?.owner;
    } else if (req.path === "/email-settings/logo" && req.query.organisationId !== undefined) {
      owner = Number(req.query.organisationId);
    } else if (req.path.startsWith("/service-docs/public/file/")) {
      const id = Number(req.path.split("/").at(-1));
      const [file] = Number.isSafeInteger(id) && id > 0
        ? await systemDb.select({ owner: fileLibraryTable.organisationId }).from(fileLibraryTable).where(eq(fileLibraryTable.id, id)).limit(1)
        : [];
      owner = file?.owner;
    } else if (req.query.siteId !== undefined) {
      const siteId = Number(req.query.siteId);
      const [site] = Number.isSafeInteger(siteId) && siteId > 0
        ? await systemDb.select({ owner: sitesTable.orgId }).from(sitesTable).where(eq(sitesTable.id, siteId)).limit(1)
        : [];
      owner = site?.owner;
    } else if (req.query.organisationId !== undefined) {
      const id = Number(req.query.organisationId);
      const [company] = Number.isSafeInteger(id) && id > 0
        ? await systemDb.select({ id: organisationTable.id }).from(organisationTable).where(eq(organisationTable.id, id)).limit(1)
        : [];
      owner = company?.id;
    } else if (typeof req.query.organisationCode === "string") {
      const matches = await systemDb.select({ id: organisationTable.id }).from(organisationTable)
        .where(eq(sql`lower(${organisationTable.organisationId})`, req.query.organisationCode.trim().toLowerCase())).limit(2);
      if (matches.length === 1) owner = matches[0].id;
    } else {
      // Preserve old public links only while their company is unambiguous.
      // Never choose the first company after a second one has been introduced.
      const matches = await systemDb.select({ id: organisationTable.id }).from(organisationTable).limit(2);
      if (matches.length === 1) owner = matches[0].id;
    }
    if (!Number.isSafeInteger(owner) || !owner || owner <= 0) {
      res.status(404).json({ error: "Public company resource not found. Use a company or service-specific link." }); return;
    }
    res.locals.publicOrganisationId = owner;
    withOrganisationContext(owner, next);
  } catch (error) { next(error); }
};
