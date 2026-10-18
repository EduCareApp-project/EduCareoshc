import type { RequestHandler } from "express";
import { eq } from "drizzle-orm";
import { systemDb as db, withOrganisationContext, staffTable, parentAccountsTable, schoolAccountsTable, sitesTable } from "@workspace/db";

/**
 * Resolve ownership from the authenticated account, never a URL, request body,
 * email domain, first-company lookup, or a stale company ID in a session.
 * Membership is re-read so moving/removing an account takes effect immediately.
 */
export const organisationContext: RequestHandler = async (req, res, next) => {
  const user = req.session?.user;
  if (!user) { res.status(401).json({ error: "Sign in to access your organisation" }); return; }
  // Only server middleware can set locals. Avoid repeating the membership query
  // when a scoped router is mounted behind the central guard.
  if (res.locals.organisationContextVerified === true) { next(); return; }
  try {
    let organisationId: number | null | undefined;
    if (user.type === "staff") {
      const [account] = await db.select({ organisationId: staffTable.organisationId,
        role: staffTable.role, siteId: staffTable.siteId, email: staffTable.email,
        blockedAt: staffTable.blockedAt })
        .from(staffTable).where(eq(staffTable.id, user.id)).limit(1);
      organisationId = account?.organisationId;
      if (account?.blockedAt) { res.status(403).json({ error: "Account access has been disabled" }); return; }
      if (account?.role !== undefined) user.role = account.role;
      if (account?.siteId !== undefined) user.siteId = account.siteId;
      if (account?.email !== undefined) user.email = account.email;
    } else if (user.type === "guardian") {
      const [account] = await db.select({ organisationId: parentAccountsTable.organisationId,
        email: parentAccountsTable.guardianEmail, blockedAt: parentAccountsTable.blockedAt })
        .from(parentAccountsTable).where(eq(parentAccountsTable.id, user.id)).limit(1);
      organisationId = account?.organisationId;
      if (account?.blockedAt) { res.status(403).json({ error: "Account access has been disabled" }); return; }
      if (account?.email !== undefined) user.email = account.email;
    } else if (user.type === "school") {
      const [account] = await db.select({ organisationId: sitesTable.orgId, siteId: schoolAccountsTable.siteId, blockedAt: schoolAccountsTable.blockedAt })
        .from(schoolAccountsTable)
        .innerJoin(sitesTable, eq(schoolAccountsTable.siteId, sitesTable.id))
        .where(eq(schoolAccountsTable.id, user.id)).limit(1);
      if (account?.blockedAt) { res.status(403).json({ error: "Account access has been disabled" }); return; }
      // The downstream school guard still scopes paths using the session site.
      // Do not let a moved account combine its new company with an old site.
      if (account && account.siteId !== user.siteId) {
        res.status(403).json({ error: "Your school service assignment changed. Please sign in again." });
        return;
      }
      organisationId = account?.organisationId;
    }
    if (!Number.isSafeInteger(organisationId) || organisationId! <= 0) {
      res.status(403).json({ error: "Your account has no organisation assigned. Contact your administrator." });
      return;
    }
    res.locals.organisationId = organisationId;
    res.locals.organisationContextVerified = true;
    withOrganisationContext(organisationId!, next);
  } catch (err) {
    req.log.error({ err }, "Unable to verify account organisation");
    res.status(503).json({ error: "Unable to verify your organisation. Please try again." });
  }
};
