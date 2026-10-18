export function normalizeSiteIdentifierBody(body: Record<string, unknown> | undefined) {
  if (typeof body?.identifier !== "string") return body;
  return { ...body, identifier: body.identifier.trim().toUpperCase() || null };
}

export function isDuplicateSiteIdentifier(error: unknown): boolean {
  // Drizzle wraps the PostgreSQL error in cause.
  const outer = error as { code?: string; constraint?: string; cause?: unknown };
  const detail = (outer?.cause ?? outer) as { code?: string; constraint?: string };
  return detail?.code === "23505" && (
    detail.constraint === "sites_organisation_identifier_unique" || detail.constraint === "sites_identifier_unique"
  );
}
